import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { BranchAccessService } from './branch-access.service';

describe('BranchAccessService', () => {
  let service: BranchAccessService;

  const prismaMock = {
    branch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const operatorUser = {
    sub: 'u-op',
    id: 'u-op',
    organizationId: 'org-1',
    role: 'OPERATOR' as const,
    branchId: 'branch-1',
    roles: ['OPERATOR'],
    permissions: [],
  };

  const managerScopedUser = {
    sub: 'u-mgr',
    id: 'u-mgr',
    organizationId: 'org-1',
    role: 'MANAGER' as const,
    branchId: 'branch-1',
    roles: ['MANAGER'],
    permissions: [],
  };

  const adminUser = {
    sub: 'u-admin',
    id: 'u-admin',
    organizationId: 'org-1',
    role: 'ADMIN' as const,
    branchId: null,
    roles: ['ADMIN'],
    permissions: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BranchAccessService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(BranchAccessService);
  });

  it('returns operator branch as the only accessible branch', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });

    const branches = await service.getAccessibleBranches(operatorUser);

    expect(branches).toEqual(['branch-1']);
  });

  it('denies manager with fixed branch when requesting a different branch', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-1',
      name: 'North',
      code: 'NORTH',
      isActive: true,
    });

    const promise = service.resolveBranchForFilter(
      managerScopedUser,
      'branch-2',
    );

    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: ErrorCodes.ACCESS_DENIED,
      },
      status: 403,
    });
  });

  it('returns RESOURCE_NOT_FOUND for cross-tenant branch id checks', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-foreign',
      organizationId: 'org-2',
      name: 'Foreign',
      code: 'FOR',
      isActive: true,
    });

    await expect(
      service.resolveBranchForCreate(adminUser, 'branch-foreign'),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      },
      status: 404,
    });
  });

  it('returns organization active branches for org-wide users', async () => {
    (prismaMock.branch.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'HQ',
        code: 'HQ',
        isActive: true,
      },
      {
        id: 'branch-2',
        organizationId: 'org-1',
        name: 'North',
        code: 'NORTH',
        isActive: true,
      },
    ]);

    const branches = await service.getAccessibleBranches(adminUser);

    expect(branches).toEqual(['branch-1', 'branch-2']);
  });
});
