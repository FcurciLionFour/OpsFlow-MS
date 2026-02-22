/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PermissionCatalog } from 'src/common/rbac';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  let service: BranchesService;

  const prismaMock = {
    branch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const user = {
    sub: 'u1',
    id: 'u1',
    organizationId: 'org-1',
    role: 'ADMIN' as const,
    branchId: null,
    roles: ['ADMIN'],
    permissions: [
      PermissionCatalog.BRANCH_READ,
      PermissionCatalog.BRANCH_CREATE,
      PermissionCatalog.BRANCH_UPDATE,
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(BranchesService);
  });

  it('findAll scopes by organization and active by default', async () => {
    const findManyMock = prismaMock.branch.findMany as jest.Mock;
    findManyMock.mockResolvedValue([]);

    await service.findAll(user, {});

    const findManyCall = findManyMock.mock.calls[0] as [
      { where: { organizationId: string; isActive: boolean } },
    ];
    const [findManyArg] = findManyCall;

    expect(findManyArg.where).toEqual({
      organizationId: 'org-1',
      isActive: true,
    });
  });

  it('findOne throws when branch is not found in tenant', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne('b1', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOne returns RESOURCE_NOT_FOUND when branch belongs to another organization', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'b1',
      organizationId: 'org-2',
      name: 'Other',
      code: 'OTHER',
      isActive: true,
    });

    await expect(service.findOne('b1', user)).rejects.toMatchObject({
      response: {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      },
      status: 404,
    });
  });

  it('create normalizes code to uppercase', async () => {
    const createMock = prismaMock.branch.create as jest.Mock;
    createMock.mockResolvedValue({
      id: 'b1',
      organizationId: 'org-1',
      name: 'Main',
      code: 'MAIN',
      isActive: true,
    });

    await service.create({ name: 'Main', code: 'main' }, user);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createArg = createMock.mock.calls[0]?.[0] as {
      data: { code: string };
    };

    expect(createArg.data.code).toBe('MAIN');
  });

  it('create throws when organization code is duplicated', async () => {
    const createMock = prismaMock.branch.create as jest.Mock;
    createMock.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['organizationId', 'code'] },
    });

    await expect(
      service.create({ name: 'Main', code: 'MAIN' }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
