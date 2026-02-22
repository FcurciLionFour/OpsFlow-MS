/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CashMovementStatus, CashMovementType, Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { BranchAccessService } from 'src/branches/branch-access.service';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PermissionCatalog } from 'src/common/rbac';
import { PrismaService } from 'src/prisma/prisma.service';
import { CashMovementsService } from './cash-movements.service';

describe('CashMovementsService', () => {
  let service: CashMovementsService;

  const prismaMock = {
    branch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    cashMovement: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    ),
  } as unknown as PrismaService;

  const operatorUser = {
    sub: 'u1',
    id: 'u1',
    organizationId: 'org-1',
    role: 'OPERATOR' as const,
    branchId: 'branch-1',
    roles: ['OPERATOR'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
    ],
  };

  const adminUser = {
    sub: 'u-admin',
    id: 'u-admin',
    organizationId: 'org-1',
    role: 'ADMIN' as const,
    branchId: null,
    roles: ['ADMIN'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASH_MOVEMENT_APPROVE,
      PermissionCatalog.CASH_MOVEMENT_REJECT,
      PermissionCatalog.CASH_MOVEMENT_DELIVER,
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CashMovementsService,
        BranchAccessService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(CashMovementsService);
  });

  it('OPERATOR create enforces PENDING and infers branch from session', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });
    (prismaMock.cashMovement.create as jest.Mock).mockResolvedValue({
      id: 'cm-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      amount: new Prisma.Decimal('25.00'),
      currency: 'ARS',
      type: CashMovementType.OUT,
      status: CashMovementStatus.PENDING,
      description: null,
      createdById: 'u1',
      approvedById: null,
      deliveredById: null,
      createdAt: new Date('2026-02-19T00:00:00.000Z'),
      updatedAt: new Date('2026-02-19T00:00:00.000Z'),
    });

    const result = await service.create(
      {
        amount: '25.00',
        type: CashMovementType.OUT,
        branchId: 'branch-other',
      },
      operatorUser,
    );

    expect(prismaMock.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: 'branch-1',
          status: CashMovementStatus.PENDING,
          createdById: 'u1',
        }),
      }),
    );
    expect(result.status).toBe(CashMovementStatus.PENDING);
    expect(result.branchId).toBe('branch-1');
  });

  it('throws 409 CASHFLOW_INVALID_TRANSITION on invalid status transition', async () => {
    (prismaMock.cashMovement.findFirst as jest.Mock).mockResolvedValue({
      id: 'cm-2',
      organizationId: 'org-1',
      branchId: 'branch-1',
      amount: new Prisma.Decimal('50.00'),
      currency: 'ARS',
      type: CashMovementType.IN,
      status: CashMovementStatus.PENDING,
      description: null,
      createdById: 'u1',
      approvedById: null,
      deliveredById: null,
      createdAt: new Date('2026-02-19T00:00:00.000Z'),
      updatedAt: new Date('2026-02-19T00:00:00.000Z'),
    });
    (prismaMock.branch.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'HQ',
        code: 'HQ',
        isActive: true,
      },
    ]);
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });

    const promise = service.deliver('cm-2', adminUser);

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: ErrorCodes.CASHFLOW_INVALID_TRANSITION,
        details: {
          from: CashMovementStatus.PENDING,
          to: CashMovementStatus.DELIVERED,
        },
      },
      status: 409,
    });
  });

  it('returns RESOURCE_NOT_FOUND for cross-tenant movement access', async () => {
    (prismaMock.cashMovement.findFirst as jest.Mock).mockResolvedValue({
      id: 'cm-foreign',
      organizationId: 'org-2',
      branchId: 'branch-x',
      amount: new Prisma.Decimal('40.00'),
      currency: 'ARS',
      type: CashMovementType.OUT,
      status: CashMovementStatus.PENDING,
      description: null,
      createdById: 'u2',
      approvedById: null,
      deliveredById: null,
      createdAt: new Date('2026-02-19T00:00:00.000Z'),
      updatedAt: new Date('2026-02-19T00:00:00.000Z'),
    });

    const promise = service.approve('cm-foreign', adminUser);

    await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      },
      status: 404,
    });
  });

  it('returns amount as string in paginated list payload', async () => {
    (prismaMock.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organizationId: 'org-1',
      name: 'HQ',
      code: 'HQ',
      isActive: true,
    });
    (prismaMock.cashMovement.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cm-3',
        organizationId: 'org-1',
        branchId: 'branch-1',
        amount: new Prisma.Decimal('123.40'),
        currency: 'ARS',
        type: CashMovementType.IN,
        status: CashMovementStatus.APPROVED,
        description: null,
        createdById: 'u1',
        approvedById: 'u-admin',
        deliveredById: null,
        createdAt: new Date('2026-02-19T00:00:00.000Z'),
        updatedAt: new Date('2026-02-19T00:00:00.000Z'),
      },
    ]);
    (prismaMock.cashMovement.count as jest.Mock).mockResolvedValue(1);

    const result = await service.findAll({}, operatorUser);

    expect(result.data[0].amount).toBe('123.40');
    expect(result.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });
});
