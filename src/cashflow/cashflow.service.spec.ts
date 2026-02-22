/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { BranchAccessService } from 'src/branches/branch-access.service';
import { PermissionCatalog } from 'src/common/rbac';
import { PrismaService } from 'src/prisma/prisma.service';
import { CashflowService } from './cashflow.service';

describe('CashflowService', () => {
  let service: CashflowService;

  const prismaMock = {
    branch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    cashMovement: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  } as unknown as PrismaService;

  const operatorUser = {
    sub: 'u-op',
    id: 'u-op',
    organizationId: 'org-1',
    role: 'OPERATOR' as const,
    branchId: 'branch-1',
    roles: ['OPERATOR'],
    permissions: [PermissionCatalog.CASHFLOW_STATS_READ],
  };

  const managerScopedUser = {
    sub: 'u-manager',
    id: 'u-manager',
    organizationId: 'org-1',
    role: 'MANAGER' as const,
    branchId: 'branch-1',
    roles: ['MANAGER'],
    permissions: [PermissionCatalog.CASHFLOW_STATS_READ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CashflowService,
        BranchAccessService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(CashflowService);
  });

  it('blocks OPERATOR branch override attempts', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-2',
      organizationId: 'org-1',
      name: 'North',
      code: 'NORTH',
      isActive: true,
    });

    await expect(
      service.getStats({ branchId: 'branch-2' }, operatorUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forces MANAGER with assigned branch to its own branch scope', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });
    (prismaMock.cashMovement.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(0) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(0) } });
    (prismaMock.cashMovement.count as jest.Mock).mockResolvedValue(0);

    await service.getStats({}, managerScopedUser);

    expect(prismaMock.cashMovement.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
          organizationId: 'org-1',
        }),
      }),
    );
  });

  it('returns decimal totals as strings', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });
    (prismaMock.cashMovement.aggregate as jest.Mock)
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal('120.00') },
      })
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal('20.50') },
      });
    (prismaMock.cashMovement.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

    const result = await service.getStats({}, operatorUser);

    expect(result.cards).toEqual(
      expect.objectContaining({
        totalIn: '120.00',
        totalOut: '20.50',
        net: '99.50',
      }),
    );
  });
});
