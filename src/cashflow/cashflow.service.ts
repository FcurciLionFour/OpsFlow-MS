import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMovementStatus, CashMovementType, Prisma } from '@prisma/client';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { BranchAccessService } from 'src/branches/branch-access.service';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { CashflowStatsQueryDto } from './dto/cashflow-stats-query.dto';

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class CashflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccessService: BranchAccessService,
  ) {}

  async getStats(
    query: CashflowStatsQueryDto,
    currentUser: AuthenticatedUserContext,
  ) {
    const { from, to } = this.resolveRange(query.from, query.to);
    const branchId = await this.branchAccessService.resolveBranchForFilter(
      currentUser,
      query.branchId,
    );

    const where: Prisma.CashMovementWhereInput = {
      organizationId: currentUser.organizationId,
      ...(branchId ? { branchId } : {}),
      ...((from || to) && {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      }),
    };

    const [
      totalInAggregate,
      totalOutAggregate,
      pendingCount,
      approvedCount,
      deliveredCount,
      rejectedCount,
    ] = await this.prisma.$transaction([
      this.prisma.cashMovement.aggregate({
        where: {
          ...where,
          type: CashMovementType.IN,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.cashMovement.aggregate({
        where: {
          ...where,
          type: CashMovementType.OUT,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.cashMovement.count({
        where: {
          ...where,
          status: CashMovementStatus.PENDING,
        },
      }),
      this.prisma.cashMovement.count({
        where: {
          ...where,
          status: CashMovementStatus.APPROVED,
        },
      }),
      this.prisma.cashMovement.count({
        where: {
          ...where,
          status: CashMovementStatus.DELIVERED,
        },
      }),
      this.prisma.cashMovement.count({
        where: {
          ...where,
          status: CashMovementStatus.REJECTED,
        },
      }),
    ]);

    const totalIn = new Prisma.Decimal(totalInAggregate._sum.amount ?? 0);
    const totalOut = new Prisma.Decimal(totalOutAggregate._sum.amount ?? 0);
    const net = totalIn.minus(totalOut);

    return {
      range: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      branchId,
      cards: {
        totalIn: totalIn.toFixed(2),
        totalOut: totalOut.toFixed(2),
        net: net.toFixed(2),
        pendingCount,
        approvedCount,
        deliveredCount,
        rejectedCount,
      },
    };
  }

  private resolveRange(from?: string, to?: string) {
    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;

    if (parsedFrom && Number.isNaN(parsedFrom.getTime())) {
      throw new BadRequestException({
        code: ErrorCodes.STATS_INVALID_DATE_RANGE,
        message: 'Invalid from date',
      });
    }

    if (parsedTo && Number.isNaN(parsedTo.getTime())) {
      throw new BadRequestException({
        code: ErrorCodes.STATS_INVALID_DATE_RANGE,
        message: 'Invalid to date',
      });
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException({
        code: ErrorCodes.STATS_INVALID_DATE_RANGE,
        message: 'Invalid date range',
      });
    }

    if (!parsedFrom && !parsedTo) {
      const now = new Date();
      const defaultFrom = new Date(now.getTime());
      defaultFrom.setUTCDate(defaultFrom.getUTCDate() - DEFAULT_RANGE_DAYS);
      return { from: defaultFrom, to: now };
    }

    return { from: parsedFrom, to: parsedTo };
  }
}
