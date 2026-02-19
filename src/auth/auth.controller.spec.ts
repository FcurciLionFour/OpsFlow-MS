import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getSession: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  const configMock = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'cookies.sameSite') return 'lax';
      if (key === 'cookies.secure') return false;
      if (key === 'cookies.refreshMaxAgeMs') return 604800000;
      if (key === 'cookies.csrfMaxAgeMs') return 7200000;
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('sets refresh cookie on login', async () => {
    authServiceMock.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    } as unknown as Request;

    const result = await controller.login(
      { email: 'e@test.com', password: 'x' },
      req,
      res,
    );

    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 604800000,
      }),
    );
    expect(result.accessToken).toBe('access');
  });

  it('forwards logout with parsed refresh token', async () => {
    const clearCookie = jest.fn();
    const res = { clearCookie } as unknown as Response;
    const req = {
      cookies: { refresh_token: 'refresh-token' },
    } as unknown as Request;

    await controller.logout(req, res);

    expect(authServiceMock.logout).toHaveBeenCalledWith('refresh-token');
    expect(clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('forwards register payload to service', () => {
    authServiceMock.register.mockReturnValue({ ok: true });

    const result = controller.register({
      email: 'new@test.com',
      password: 'Password123',
    });

    expect(authServiceMock.register).toHaveBeenCalledWith(
      'new@test.com',
      'Password123',
    );
    expect(result).toEqual({ ok: true });
  });

  it('sets csrf cookie on csrf endpoint', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    const result = controller.getCsrf(res);

    expect(cookie).toHaveBeenCalledWith(
      'csrf_token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 7200000,
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('forwards refresh using cookie token and sets new refresh cookie', async () => {
    authServiceMock.refresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      cookies: { refresh_token: 'old-refresh' },
    } as unknown as Request;

    const result = await controller.refresh(req, res);

    expect(authServiceMock.refresh).toHaveBeenCalledWith('old-refresh', {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      'new-refresh',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result).toEqual({ accessToken: 'new-access' });
  });

  it('uses empty refresh token when cookie is missing', async () => {
    authServiceMock.refresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      cookies: {},
    } as unknown as Request;

    await controller.refresh(req, res);

    expect(authServiceMock.refresh).toHaveBeenCalledWith('', {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
  });

  it('returns current session through me endpoint', () => {
    authServiceMock.getSession.mockReturnValue({ user: { id: 'u1' } });

    const result = controller.me({ sub: 'u1' });

    expect(authServiceMock.getSession).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ user: { id: 'u1' } });
  });

  it('forwards forgot-password payload', () => {
    authServiceMock.forgotPassword.mockReturnValue({ ok: true });

    const result = controller.forgotPassword({ email: 'user@test.com' });

    expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(
      'user@test.com',
    );
    expect(result).toEqual({ ok: true });
  });

  it('forwards reset-password payload', () => {
    authServiceMock.resetPassword.mockReturnValue({ ok: true });

    const result = controller.resetPassword({
      token: 'a0fd42b8-7ad2-4f4f-99de-670c7fe74ff7',
      newPassword: 'Password123',
    });

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(
      'a0fd42b8-7ad2-4f4f-99de-670c7fe74ff7',
      'Password123',
    );
    expect(result).toEqual({ ok: true });
  });

  it('forwards change-password payload', () => {
    authServiceMock.changePassword.mockReturnValue({ ok: true });

    const result = controller.changePassword(
      { sub: 'user-1' },
      { currentPassword: 'old-pass', newPassword: 'new-pass' },
    );

    expect(authServiceMock.changePassword).toHaveBeenCalledWith(
      'user-1',
      'old-pass',
      'new-pass',
    );
    expect(result).toEqual({ ok: true });
  });
});
