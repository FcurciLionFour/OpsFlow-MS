import {
  ForbiddenException,
  NotFoundException,
  type INestApplicationContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from './users.service';

type PrismaMock = {
  user: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  role: {
    findMany: jest.Mock;
  };
  userRole: {
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
};

describe('UsersService', () => {
  let app: INestApplicationContext;
  let service: UsersService;

  const prismaMock: PrismaMock = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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

  it('findAll returns active users mapped to response DTO', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@test.com',
        roles: [{ role: { name: 'ADMIN' } }],
      },
      {
        id: 'u2',
        email: 'b@test.com',
        roles: [{ role: { name: 'USER' } }],
      },
    ]);

    const result = await service.findAll();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
    expect(result).toEqual([
      { id: 'u1', email: 'a@test.com', roles: ['ADMIN'] },
      { id: 'u2', email: 'b@test.com', roles: ['USER'] },
    ]);
  });

  it('findById allows self-access and returns user', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'self@test.com',
      roles: [{ role: { name: 'USER' } }],
    });

    const result = await service.findById('u1', 'u1');

    expect(result).toEqual({
      id: 'u1',
      email: 'self@test.com',
      roles: ['USER'],
    });
  });

  it('findById denies access for non-admin accessing another user', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue(null);

    await expect(
      service.findById('target', 'requester'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findById throws not found when target user does not exist', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing', 'admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create hashes password when creating admin-managed users', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-1', name: 'ADMIN' },
    ]);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'admin-created@test.com',
      roles: [{ role: { name: 'ADMIN' } }],
    });

    const result = await service.create({
      email: 'admin-created@test.com',
      password: 'PlainTextPass123',
      roles: ['ADMIN'],
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createCallArg = prismaMock.user.create.mock.calls[0]?.[0] as {
      data: { password: string };
    };

    expect(createCallArg.data.password).toMatch(/^\$2[aby]\$/);
    expect(result).toEqual({
      id: 'user-1',
      email: 'admin-created@test.com',
      roles: ['ADMIN'],
    });
  });

  it('create throws when user already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create({
        email: 'existing@test.com',
        password: 'Password123',
        roles: ['USER'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when roles are missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        email: 'roles@test.com',
        password: 'Password123',
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws when one or more roles are invalid', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-1', name: 'ADMIN' },
    ]);

    await expect(
      service.create({
        email: 'invalid-roles@test.com',
        password: 'abc',
        roles: ['ADMIN', 'UNKNOWN'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update updates scalar fields and role relations', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'u1', email: 'before@test.com' })
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'after@test.com',
        isActive: true,
        roles: [{ role: { name: 'ADMIN' } }],
      });
    prismaMock.role.findMany.mockResolvedValue([{ id: 'r1', name: 'ADMIN' }]);

    const result = await service.update(
      'u1',
      { email: 'after@test.com', roles: ['ADMIN'] },
      'admin',
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'after@test.com' },
    });
    expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prismaMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', roleId: 'r1' }],
    });
    expect(result).toEqual({
      id: 'u1',
      email: 'after@test.com',
      isActive: true,
      roles: ['ADMIN'],
    });
  });

  it('update throws when user does not exist', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', {}, 'admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update throws when roles payload is empty', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.update('u1', { roles: [] }, 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update throws when roles payload contains invalid role', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.role.findMany.mockResolvedValue([{ id: 'r1', name: 'ADMIN' }]);

    await expect(
      service.update('u1', { roles: ['ADMIN', 'UNKNOWN'] }, 'admin'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('remove soft deletes the user', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    const result = await service.remove('u1', 'admin');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws when user does not exist', async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ id: 'admin-role' });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing', 'admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
