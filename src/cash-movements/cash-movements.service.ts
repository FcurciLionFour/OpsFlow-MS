import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashMovementStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { BranchAccessService } from 'src/branches/branch-access.service';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { isValidCashMovementTransition } from './cash-movement-transition.validator';
import {
  CashMovementRecord,
  CashMovementsRepository,
} from './cash-movements.repository';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { ListCashMovementsDto } from './dto/list-cash-movements.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class CashMovementsService {
  private readonly cashMovementsRepository: CashMovementsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccessService: BranchAccessService,
  ) {
    this.cashMovementsRepository = new CashMovementsRepository(prisma);
  }

  async create(
    dto: CreateCashMovementDto,
    currentUser: AuthenticatedUserContext,
  ) {
    const branchId = await this.branchAccessService.resolveBranchForCreate(
      currentUser,
      dto.branchId,
    );

    const amount = this.parseAmount(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException({
        code: ErrorCodes.CASH_MOVEMENTS_INVALID_AMOUNT,
        message: 'amount must be greater than 0',
      });
    }

    const movement = await this.cashMovementsRepository.create(
      currentUser.organizationId,
      {
        branchId,
        createdById: currentUser.id,
        type: dto.type,
        status: CashMovementStatus.PENDING,
        amount,
        currency: dto.currency?.trim().toUpperCase() || 'ARS',
        description: dto.description?.trim() || null,
      },
    );

    return this.mapMovement(movement);
  }

  async findAll(
    query: ListCashMovementsDto,
    currentUser: AuthenticatedUserContext,
  ) {
    const { from, to } = this.parseDateRange(query.from, query.to);
    const branchId = await this.branchAccessService.resolveBranchForFilter(
      currentUser,
      query.branchId,
    );
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const result = await this.cashMovementsRepository.list(
      currentUser.organizationId,
      {
        branchId: branchId ?? undefined,
        status: query.status,
        from,
        to,
        page,
        pageSize,
      },
    );

    const totalPages =
      result.total === 0 ? 0 : Math.ceil(result.total / pageSize);

    return {
      data: result.items.map((movement) => this.mapMovement(movement)),
      meta: {
        page,
        pageSize,
        total: result.total,
        totalPages,
      },
    };
  }

  approve(id: string, currentUser: AuthenticatedUserContext) {
    return this.transition(
      id,
      CashMovementStatus.APPROVED,
      currentUser,
      'approvedById',
    );
  }

  reject(id: string, currentUser: AuthenticatedUserContext) {
    return this.transition(
      id,
      CashMovementStatus.REJECTED,
      currentUser,
      'approvedById',
    );
  }

  deliver(id: string, currentUser: AuthenticatedUserContext) {
    return this.transition(
      id,
      CashMovementStatus.DELIVERED,
      currentUser,
      'deliveredById',
    );
  }

  private async transition(
    id: string,
    targetStatus: CashMovementStatus,
    currentUser: AuthenticatedUserContext,
    actorField: 'approvedById' | 'deliveredById',
  ) {
    const movement = await this.cashMovementsRepository.findById(
      currentUser.organizationId,
      id,
    );

    if (!movement) {
      throw new NotFoundException({
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: 'Resource not found',
      });
    }

    await this.branchAccessService.assertBranchAccessible(
      currentUser,
      movement.branchId,
    );

    if (!isValidCashMovementTransition(movement.status, targetStatus)) {
      throw new ConflictException({
        code: ErrorCodes.CASHFLOW_INVALID_TRANSITION,
        message: 'Invalid cash movement transition',
        details: {
          from: movement.status,
          to: targetStatus,
        },
      });
    }

    const actorPatch =
      actorField === 'approvedById'
        ? { approvedById: currentUser.id }
        : { deliveredById: currentUser.id };

    const updated = await this.cashMovementsRepository.updateStatus(
      movement.id,
      {
        status: targetStatus,
        approvedById:
          targetStatus === CashMovementStatus.REJECTED
            ? null
            : actorPatch.approvedById,
        deliveredById: actorPatch.deliveredById,
      },
    );

    return this.mapMovement(updated);
  }

  private parseAmount(amount: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(amount);
    } catch {
      throw new BadRequestException({
        code: ErrorCodes.CASH_MOVEMENTS_INVALID_AMOUNT,
        message: 'amount must be a valid decimal',
      });
    }
  }

  private parseDateRange(from?: string, to?: string) {
    const parsedFrom = from ? new Date(from) : null;
    const parsedTo = to ? new Date(to) : null;

    if (parsedFrom && Number.isNaN(parsedFrom.getTime())) {
      throw new BadRequestException({
        code: ErrorCodes.CASH_MOVEMENTS_INVALID_DATE_RANGE,
        message: 'Invalid from date',
      });
    }

    if (parsedTo && Number.isNaN(parsedTo.getTime())) {
      throw new BadRequestException({
        code: ErrorCodes.CASH_MOVEMENTS_INVALID_DATE_RANGE,
        message: 'Invalid to date',
      });
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException({
        code: ErrorCodes.CASH_MOVEMENTS_INVALID_DATE_RANGE,
        message: 'Invalid date range',
      });
    }

    return { from: parsedFrom, to: parsedTo };
  }

  private mapMovement(movement: CashMovementRecord) {
    return {
      id: movement.id,
      organizationId: movement.organizationId,
      branchId: movement.branchId,
      createdById: movement.createdById,
      approvedById: movement.approvedById,
      deliveredById: movement.deliveredById,
      type: movement.type,
      status: movement.status,
      amount: movement.amount.toFixed(2),
      currency: movement.currency,
      description: movement.description,
      createdAt: movement.createdAt.toISOString(),
      updatedAt: movement.updatedAt.toISOString(),
    };
  }
}
