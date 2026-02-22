/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { randomUUID } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CashMovementStatus, CashMovementType, Prisma } from '@prisma/client';
import request from 'supertest';
import { BranchesModule } from 'src/branches/branches.module';
import { CashflowModule } from 'src/cashflow/cashflow.module';
import { CashMovementsModule } from 'src/cash-movements/cash-movements.module';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PermissionCatalog } from 'src/common/rbac';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';

type RuntimeUser = {
  sub: string;
  id: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  branchId: string | null;
  roles: string[];
  permissions: string[];
};

const usersByToken: Record<string, RuntimeUser> = {
  'admin-org-1': {
    sub: 'admin-org-1',
    id: 'admin-org-1',
    organizationId: 'org-1',
    role: 'ADMIN',
    branchId: null,
    roles: ['ADMIN'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASH_MOVEMENT_APPROVE,
      PermissionCatalog.CASH_MOVEMENT_REJECT,
      PermissionCatalog.CASH_MOVEMENT_DELIVER,
      PermissionCatalog.CASHFLOW_STATS_READ,
    ],
  },
  'manager-org-1': {
    sub: 'manager-org-1',
    id: 'manager-org-1',
    organizationId: 'org-1',
    role: 'MANAGER',
    branchId: 'branch-1',
    roles: ['MANAGER'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASH_MOVEMENT_APPROVE,
      PermissionCatalog.CASH_MOVEMENT_REJECT,
      PermissionCatalog.CASH_MOVEMENT_DELIVER,
      PermissionCatalog.CASHFLOW_STATS_READ,
    ],
  },
  'operator-org-1': {
    sub: 'operator-org-1',
    id: 'operator-org-1',
    organizationId: 'org-1',
    role: 'OPERATOR',
    branchId: 'branch-1',
    roles: ['OPERATOR'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASHFLOW_STATS_READ,
    ],
  },
};

@Injectable()
class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: RuntimeUser;
    }>();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }

    const token = authHeader.substring('Bearer '.length).trim();
    const user = usersByToken[token];
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }

    req.user = user;
    return true;
  }
}

type BranchRecord = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  isActive: boolean;
};

type CashMovementRecord = {
  id: string;
  organizationId: string;
  branchId: string;
  amount: Prisma.Decimal;
  currency: string;
  type: CashMovementType;
  status: CashMovementStatus;
  description: string | null;
  createdById: string;
  approvedById: string | null;
  deliveredById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function createPrismaMock() {
  const branches: BranchRecord[] = [
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
    {
      id: 'branch-foreign',
      organizationId: 'org-2',
      name: 'Foreign',
      code: 'FOR',
      isActive: true,
    },
  ];

  const movements: CashMovementRecord[] = [
    {
      id: 'cm-pending-org1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      amount: new Prisma.Decimal('100.00'),
      currency: 'ARS',
      type: CashMovementType.IN,
      status: CashMovementStatus.PENDING,
      description: null,
      createdById: 'operator-org-1',
      approvedById: null,
      deliveredById: null,
      createdAt: new Date('2026-02-10T10:00:00.000Z'),
      updatedAt: new Date('2026-02-10T10:00:00.000Z'),
    },
    {
      id: 'cm-approved-org1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      amount: new Prisma.Decimal('75.50'),
      currency: 'ARS',
      type: CashMovementType.OUT,
      status: CashMovementStatus.APPROVED,
      description: 'approved test',
      createdById: 'operator-org-1',
      approvedById: 'manager-org-1',
      deliveredById: null,
      createdAt: new Date('2026-02-11T10:00:00.000Z'),
      updatedAt: new Date('2026-02-11T10:00:00.000Z'),
    },
    {
      id: 'cm-org2',
      organizationId: 'org-2',
      branchId: 'branch-foreign',
      amount: new Prisma.Decimal('120.00'),
      currency: 'ARS',
      type: CashMovementType.IN,
      status: CashMovementStatus.PENDING,
      description: null,
      createdById: 'foreign-user',
      approvedById: null,
      deliveredById: null,
      createdAt: new Date('2026-02-12T10:00:00.000Z'),
      updatedAt: new Date('2026-02-12T10:00:00.000Z'),
    },
  ];

  const applyWhere = (where: any): CashMovementRecord[] => {
    return movements.filter((movement) => {
      if (
        where?.organizationId &&
        movement.organizationId !== where.organizationId
      ) {
        return false;
      }
      if (where?.branchId && movement.branchId !== where.branchId) {
        return false;
      }
      if (where?.status && movement.status !== where.status) {
        return false;
      }
      if (where?.createdAt?.gte && movement.createdAt < where.createdAt.gte) {
        return false;
      }
      if (where?.createdAt?.lte && movement.createdAt > where.createdAt.lte) {
        return false;
      }
      return true;
    });
  };

  return {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const user = Object.values(usersByToken).find(
          (candidate) => candidate.id === where.id,
        );

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          isActive: true,
        };
      }),
    },
    userRole: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) => {
        const user = Object.values(usersByToken).find(
          (candidate) => candidate.id === where.userId,
        );

        if (!user) {
          return [];
        }

        return [
          {
            role: {
              name: user.role,
              permissions: user.permissions.map((permission) => ({
                permission: {
                  key: permission,
                },
              })),
            },
          },
        ];
      }),
    },
    branch: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) => {
        return branches.find((branch) => branch.id === where.id) ?? null;
      }),
      findMany: jest.fn(
        ({
          where,
        }: {
          where: { organizationId: string; isActive?: boolean };
        }) => {
          return branches.filter((branch) => {
            if (branch.organizationId !== where.organizationId) {
              return false;
            }
            if (
              where.isActive !== undefined &&
              branch.isActive !== where.isActive
            ) {
              return false;
            }
            return true;
          });
        },
      ),
    },
    cashMovement: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) => {
        return movements.find((movement) => movement.id === where.id) ?? null;
      }),
      create: jest.fn(({ data }: { data: any }) => {
        const created: CashMovementRecord = {
          id: `cm-${randomUUID()}`,
          organizationId: data.organizationId,
          branchId: data.branchId,
          amount: new Prisma.Decimal(data.amount),
          currency: data.currency,
          type: data.type,
          status: data.status,
          description: data.description ?? null,
          createdById: data.createdById,
          approvedById: data.approvedById ?? null,
          deliveredById: data.deliveredById ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        movements.push(created);
        return created;
      }),
      findMany: jest.fn(({ where, skip, take }: any) => {
        const list = applyWhere(where)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip ?? 0, (skip ?? 0) + (take ?? 50));
        return list;
      }),
      count: jest.fn(({ where }: any) => applyWhere(where).length),
      update: jest.fn(({ where, data }: any) => {
        const movement = movements.find((item) => item.id === where.id);
        if (!movement) {
          throw new Error('Movement not found');
        }
        movement.status = data.status ?? movement.status;
        if (data.approvedById !== undefined) {
          movement.approvedById = data.approvedById;
        }
        if (data.deliveredById !== undefined) {
          movement.deliveredById = data.deliveredById;
        }
        movement.updatedAt = new Date();
        return movement;
      }),
      aggregate: jest.fn(({ where }: any) => {
        const filtered = applyWhere(where);
        if (!filtered.length) {
          return { _sum: { amount: null } };
        }

        const total = filtered.reduce(
          (sum, movement) => sum.plus(movement.amount),
          new Prisma.Decimal(0),
        );
        return { _sum: { amount: total } };
      }),
    },
    $transaction: jest.fn((ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };
}

describe('Cash movements + cashflow (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PrismaModule,
        BranchesModule,
        CashMovementsModule,
        CashflowModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: TestJwtGuard,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('OPERATOR create => PENDING and branch inferred from token scope', async () => {
    const response = await request(app.getHttpServer())
      .post('/cash-movements')
      .set('Authorization', 'Bearer operator-org-1')
      .send({
        amount: '80.00',
        type: CashMovementType.OUT,
        branchId: 'branch-2',
      })
      .expect(201);

    expect(response.body.status).toBe(CashMovementStatus.PENDING);
    expect(response.body.branchId).toBe('branch-1');
  });

  it('OPERATOR cannot approve/reject/deliver (403)', async () => {
    await request(app.getHttpServer())
      .post('/cash-movements/cm-pending-org1/approve')
      .set('Authorization', 'Bearer operator-org-1')
      .expect(403);

    await request(app.getHttpServer())
      .post('/cash-movements/cm-pending-org1/reject')
      .set('Authorization', 'Bearer operator-org-1')
      .expect(403);

    await request(app.getHttpServer())
      .post('/cash-movements/cm-pending-org1/deliver')
      .set('Authorization', 'Bearer operator-org-1')
      .expect(403);
  });

  it('invalid transition returns 409 CASHFLOW_INVALID_TRANSITION', async () => {
    const response = await request(app.getHttpServer())
      .post('/cash-movements/cm-pending-org1/deliver')
      .set('Authorization', 'Bearer manager-org-1')
      .expect(409);

    expect(response.body.code).toBe(ErrorCodes.CASHFLOW_INVALID_TRANSITION);
  });

  it('cross-tenant movement access returns 404 RESOURCE_NOT_FOUND', async () => {
    const response = await request(app.getHttpServer())
      .post('/cash-movements/cm-org2/approve')
      .set('Authorization', 'Bearer admin-org-1')
      .expect(404);

    expect(response.body.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  it('stats returns decimal totals as strings', async () => {
    const response = await request(app.getHttpServer())
      .get('/cashflow/stats')
      .set('Authorization', 'Bearer admin-org-1')
      .expect(200);

    expect(typeof response.body.cards.totalIn).toBe('string');
    expect(typeof response.body.cards.totalOut).toBe('string');
    expect(typeof response.body.cards.net).toBe('string');
  });

  it('operator cannot request stats for another branch', async () => {
    await request(app.getHttpServer())
      .get('/cashflow/stats?branchId=branch-2')
      .set('Authorization', 'Bearer operator-org-1')
      .expect(403);
  });
});
