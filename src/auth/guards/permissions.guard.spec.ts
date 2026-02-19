import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const buildContext = (user?: { sub: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no roles/permissions required', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue([]);
    const guard = new PermissionsGuard(reflectorMock, prismaMock);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('throws unauthorized when requirements exist but no user', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['users.read']);
    const guard = new PermissionsGuard(reflectorMock, prismaMock);

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws forbidden when user has no roles', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['users.read']);
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
    });
    (prismaMock.userRole.findMany as jest.Mock).mockResolvedValue([]);

    const guard = new PermissionsGuard(reflectorMock, prismaMock);

    await expect(
      guard.canActivate(buildContext({ sub: 'user-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws unauthorized when user is inactive', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['users.read']);
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      isActive: false,
    });

    const guard = new PermissionsGuard(reflectorMock, prismaMock);

    await expect(
      guard.canActivate(buildContext({ sub: 'user-1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
