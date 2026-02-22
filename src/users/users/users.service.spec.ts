import {
  ForbiddenException,
  NotFoundException,
  type INestApplicationContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PermissionCatalog } from 'src/common/rbac';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from './users.service';

const adminUser = {
  sub: 'admin-1',
  id: 'admin-1',
  organizationId: 'org-1',
  role: 'ADMIN' as const,
  branchId: null,
  roles: ['ADMIN'],
  permissions: [
    PermissionCatalog.USER_READ,
    PermissionCatalog.USER_CREATE,
    PermissionCatalog.USER_UPDATE,
  ],
};

const operatorUser = {
  sub: 'operator-1',
  id: 'operator-1',
  organizationId: 'org-1',
  role: 'OPERATOR' as const,
  branchId: 'branch-1',
  roles: ['OPERATOR'],
  permissions: [],
};

type PrismaMock = {
  user: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  role: {
    findMany: jest.Mock;
  };
  userRole: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  branch: {
    findFirst: jest.Mock;
  };
};

describe('UsersService', () => {
  let app: INestApplicationContext;
  let service: UsersService;

  const prismaMock: PrismaMock = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    app = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = app.get(UsersService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('findAll returns active users from the requester organization', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'a@test.com',
        roles: [{ role: { name: 'ADMIN' } }],
      },
      {
        id: 'u2',
        organizationId: 'org-1',
        branchId: 'branch-1',
        email: 'b@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      },
    ]);

    const result = await service.findAll(adminUser);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          organizationId: 'org-1',
        },
      }),
    );
    expect(result).toEqual([
      {
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        role: 'ADMIN',
        email: 'a@test.com',
        roles: ['ADMIN'],
      },
      {
        id: 'u2',
        organizationId: 'org-1',
        branchId: 'branch-1',
        role: 'OPERATOR',
        email: 'b@test.com',
        roles: ['OPERATOR'],
      },
    ]);
  });

  it('findById allows self access for non-admin users', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: operatorUser.id,
        organizationId: 'org-1',
        branchId: 'branch-1',
        email: 'self@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce({
        id: operatorUser.id,
        organizationId: 'org-1',
        branchId: 'branch-1',
        email: 'self@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      });

    const result = await service.findById(operatorUser.id, operatorUser);

    expect(result).toEqual({
      id: operatorUser.id,
      organizationId: 'org-1',
      branchId: 'branch-1',
      role: 'OPERATOR',
      email: 'self@test.com',
      roles: ['OPERATOR'],
    });
  });

  it('findById denies non-admin access to another user in same organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'target-1',
      organizationId: 'org-1',
      branchId: null,
      email: 'target@test.com',
      roles: [{ role: { name: 'OPERATOR' } }],
    });

    await expect(
      service.findById('target-1', operatorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when requester is not admin', async () => {
    await expect(
      service.create(
        {
          email: 'new@test.com',
          password: 'Password123',
          roles: ['OPERATOR'],
        },
        operatorUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create hashes password and pins user to requester organization', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'r1', name: 'OPERATOR' },
    ]);
    prismaMock.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'Main',
      code: 'MAIN',
      isActive: true,
    });
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      email: 'admin-created@test.com',
      roles: [{ role: { name: 'OPERATOR' } }],
    });

    const result = await service.create(
      {
        email: 'admin-created@test.com',
        password: 'PlainTextPass123',
        roles: ['OPERATOR'],
        branchId: 'branch-1',
      },
      adminUser,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createArg = prismaMock.user.create.mock.calls[0]?.[0] as {
      data: { organizationId: string; password: string };
    };

    expect(createArg.data.organizationId).toBe('org-1');
    expect(createArg.data.password).toMatch(/^\$2[aby]\$/);
    expect(result).toEqual({
      id: 'user-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      role: 'OPERATOR',
      email: 'admin-created@test.com',
      roles: ['OPERATOR'],
    });
  });

  it('create throws when user already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(
        {
          email: 'existing@test.com',
          password: 'Password123',
          roles: ['OPERATOR'],
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when roles payload is empty', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          email: 'roles@test.com',
          password: 'Password123',
          roles: [],
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when roles contain invalid values', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'r1', name: 'OPERATOR' },
    ]);

    await expect(
      service.create(
        {
          email: 'invalid@test.com',
          password: 'Password123',
          roles: ['OPERATOR', 'UNKNOWN'],
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when provided branch is outside requester organization', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'r1', name: 'OPERATOR' },
    ]);
    prismaMock.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          email: 'branch@test.com',
          password: 'Password123',
          roles: ['OPERATOR'],
          branchId: 'branch-unknown',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update applies roles and branch changes in same tenant', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'old@test.com',
        roles: [{ role: { name: 'MANAGER' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'old@test.com',
        roles: [{ role: { name: 'MANAGER' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'updated@test.com',
        roles: [{ role: { name: 'MANAGER' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'updated@test.com',
        roles: [{ role: { name: 'MANAGER' } }],
      });
    prismaMock.branch.findFirst.mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'Main',
      code: 'MAIN',
      isActive: true,
    });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-manager', name: 'MANAGER' },
    ]);

    const result = await service.update(
      'u1',
      { email: 'updated@test.com', branchId: null, roles: ['MANAGER'] },
      adminUser,
    );

    expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prismaMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', roleId: 'role-manager' }],
    });
    expect(result).toEqual({
      id: 'u1',
      organizationId: 'org-1',
      branchId: null,
      role: 'MANAGER',
      email: 'updated@test.com',
      roles: ['MANAGER'],
    });
  });

  it('update throws when roles payload is empty', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      });

    await expect(
      service.update('u1', { roles: [] }, adminUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update maps unique email violation to USER_ALREADY_EXISTS', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      });
    prismaMock.user.updateMany.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    });

    await expect(
      service.update('u1', { email: 'dup@test.com' }, adminUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update throws when updated projection is not found', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.update('u1', { email: 'final@test.com' }, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove soft deletes user in same organization', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: 'u1',
      organizationId: 'org-1',
      branchId: null,
      email: 'u1@test.com',
      roles: [{ role: { name: 'OPERATOR' } }],
    });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.remove('u1', adminUser);

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', organizationId: 'org-1' },
      data: { isActive: false },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws when target user is not found after access check', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        organizationId: 'org-1',
        branchId: null,
        email: 'u1@test.com',
        roles: [{ role: { name: 'OPERATOR' } }],
      })
      .mockResolvedValueOnce(null);
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('u1', adminUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns RESOURCE_NOT_FOUND when user belongs to another tenant', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'other-tenant-user',
      organizationId: 'org-2',
      branchId: null,
      email: 'other@test.com',
      roles: [{ role: { name: 'OPERATOR' } }],
    });

    await expect(
      service.findById('other-tenant-user', adminUser),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      },
      status: 404,
    });
  });
});
