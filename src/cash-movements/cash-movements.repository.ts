import { CashMovementStatus, CashMovementType, Prisma } from '@prisma/client';
import { assertOrganizationAccess } from 'src/common/tenancy/tenant-scope.util';
import { PrismaService } from 'src/prisma/prisma.service';

const cashMovementSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  amount: true,
  currency: true,
  type: true,
  status: true,
  description: true,
  createdById: true,
  approvedById: true,
  deliveredById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CashMovementRecord = Prisma.CashMovementGetPayload<{
  select: typeof cashMovementSelect;
}>;

export type CashMovementListFilters = {
  branchId?: string;
  status?: CashMovementStatus;
  from?: Date | null;
  to?: Date | null;
  page: number;
  pageSize: number;
};

export type CashMovementCreateInput = {
  branchId: string;
  amount: Prisma.Decimal;
  currency: string;
  type: CashMovementType;
  description: string | null;
  createdById: string;
  status: CashMovementStatus;
};

export type CashMovementStatusUpdateInput = {
  status: CashMovementStatus;
  approvedById?: string | null;
  deliveredById?: string | null;
};

export class CashMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    organizationId: string,
    id: string,
  ): Promise<CashMovementRecord | null> {
    const movement = await this.prisma.cashMovement.findFirst({
      where: { id },
      select: cashMovementSelect,
    });

    if (!movement) {
      return null;
    }

    assertOrganizationAccess(movement.organizationId, organizationId);
    return movement;
  }

  async list(
    organizationId: string,
    filters: CashMovementListFilters,
  ): Promise<{ items: CashMovementRecord[]; total: number }> {
    const where = this.buildWhereInput(organizationId, filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: filters.pageSize,
        select: cashMovementSelect,
      }),
      this.prisma.cashMovement.count({ where }),
    ]);

    return { items, total };
  }

  create(
    organizationId: string,
    data: CashMovementCreateInput,
  ): Promise<CashMovementRecord> {
    return this.prisma.cashMovement.create({
      data: {
        organizationId,
        ...data,
      },
      select: cashMovementSelect,
    });
  }

  updateStatus(
    id: string,
    data: CashMovementStatusUpdateInput,
  ): Promise<CashMovementRecord> {
    return this.prisma.cashMovement.update({
      where: { id },
      data,
      select: cashMovementSelect,
    });
  }

  private buildWhereInput(
    organizationId: string,
    filters: CashMovementListFilters,
  ): Prisma.CashMovementWhereInput {
    return {
      organizationId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...((filters.from || filters.to) && {
        createdAt: {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        },
      }),
    };
  }
}
