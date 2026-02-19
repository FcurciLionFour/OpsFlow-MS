import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginAttemptService } from './login-attempt.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    authSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const jwtMock = {
    verify: jest.fn(),
    sign: jest.fn(),
  } as any;

  const configMock = {
    getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'jwt.refreshExpiresIn') return '7d';
      return undefined;
    }),
  } as any;

  const loginAttemptMock = {
    assertNotLocked: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    jwtMock.sign.mockImplementation((payload: { sid: string }) => payload.sid);
    prismaMock.$transaction.mockImplementation((ops: unknown[]) =>
      Promise.resolve(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: LoginAttemptService, useValue: loginAttemptMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('register hashes password and creates session', async () => {
    prismaMock.user.create.mockResolvedValue({ id: 'user-1' });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await service.register('new@test.com', 'secret');

    const createArg = prismaMock.user.create.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(createArg.data.password).not.toBe('secret');
    expect(await bcrypt.compare('secret', createArg.data.password)).toBe(true);
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('register throws forbidden on duplicate email unique violation', async () => {
    prismaMock.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    });

    await expect(
      service.register('dup@test.com', 'secret'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.authSession.create).not.toHaveBeenCalled();
  });

  it('register rethrows non-email unique violations', async () => {
    const dbError = new Error('db failed');
    prismaMock.user.create.mockRejectedValue(dbError);

    await expect(service.register('dup@test.com', 'secret')).rejects.toBe(
      dbError,
    );
  });

  it('register handles unique violation when prisma target is a string', async () => {
    prismaMock.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'User_email_key' },
    });

    await expect(
      service.register('dup-string@test.com', 'secret'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('login throws for invalid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.login('missing@test.com', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(loginAttemptMock.recordFailure).toHaveBeenCalledTimes(1);
  });

  it('login succeeds with valid credentials', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      password: hashed,
    });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await service.login('ok@test.com', 'secret');

    expect(result.accessToken).toBeTruthy();
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(1);
    expect(loginAttemptMock.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it('refresh throws unauthorized when token verify fails', async () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh throws forbidden and revokes all when hash does not match', async () => {
    jwtMock.verify.mockReturnValue({ sid: 'session-1' });
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      user: { isActive: true },
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      hashedRefreshToken: await bcrypt.hash('other', 10),
    });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('refresh rotates session when valid', async () => {
    jwtMock.verify.mockReturnValue({ sid: 'session-1' });
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      user: { isActive: true },
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      hashedRefreshToken: await bcrypt.hash('refresh-token', 10),
    });
    prismaMock.authSession.update.mockResolvedValue({ id: 'session-1' });
    prismaMock.authSession.create.mockResolvedValue({ id: 'session-2' });

    const result = await service.refresh('refresh-token');

    expect(prismaMock.authSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
        replacedById: expect.any(String),
      },
    });
    expect(result.accessToken).toBeTruthy();
  });

  it('logout revokes session when refresh token is valid', async () => {
    const rawToken = 'refresh-token';
    const hashed = await bcrypt.hash(rawToken, 10);

    jwtMock.verify.mockReturnValue({ sid: 'session-1' });
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      hashedRefreshToken: hashed,
      revokedAt: null,
    });

    await service.logout(rawToken);

    expect(prismaMock.authSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
  });

  it('forgotPassword returns neutral message when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.forgotPassword('none@test.com')).resolves.toEqual({
      message: 'If the email exists, a reset link has been sent',
    });
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('forgotPassword stores a hashed token instead of raw token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await service.forgotPassword('user@test.com');

    const createArg = prismaMock.passwordResetToken.create.mock.calls[0][0] as {
      data: { token: string };
    };
    expect(createArg.data.token).toHaveLength(64);
    expect(createArg.data.token).not.toContain('-');
  });

  it('resetPassword throws for expired token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword('token', 'new-password'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('changePassword updates password and invalidates sessions', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: await bcrypt.hash('current', 10),
    });

    await expect(
      service.changePassword('user-1', 'current', 'new-pass'),
    ).resolves.toEqual({ message: 'Password updated successfully' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
