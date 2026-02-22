import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { BranchesRepository } from './branches.repository';

@Injectable()
export class BranchesService {
  private readonly branchesRepository: BranchesRepository;

  constructor(private readonly prisma: PrismaService) {
    this.branchesRepository = new BranchesRepository(prisma);
  }

  async findAll(
    currentUser: AuthenticatedUserContext,
    query: QueryBranchesDto,
  ) {
    return this.branchesRepository.list(currentUser.organizationId, query);
  }

  async findOne(id: string, currentUser: AuthenticatedUserContext) {
    const branch = await this.branchesRepository.findById(
      currentUser.organizationId,
      id,
    );

    if (!branch) {
      throw new NotFoundException({
        code: ErrorCodes.BRANCH_NOT_FOUND,
        message: 'Branch not found',
      });
    }

    return branch;
  }

  async create(dto: CreateBranchDto, currentUser: AuthenticatedUserContext) {
    try {
      return await this.branchesRepository.create(currentUser.organizationId, {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        isActive: dto.isActive ?? true,
      });
    } catch (error: unknown) {
      if (this.isUniqueCodeViolation(error)) {
        throw new ForbiddenException({
          code: ErrorCodes.BRANCH_CODE_ALREADY_EXISTS,
          message: 'Branch code already exists in organization',
        });
      }

      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    currentUser: AuthenticatedUserContext,
  ) {
    await this.findOne(id, currentUser);

    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    const updated = await this.branchesRepository.update(
      currentUser.organizationId,
      id,
      data,
    );

    if (!updated) {
      throw new NotFoundException({
        code: ErrorCodes.BRANCH_NOT_FOUND,
        message: 'Branch not found',
      });
    }

    return updated;
  }

  private isUniqueCodeViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const prismaError = error as {
      code?: unknown;
      meta?: {
        target?: unknown;
      };
    };

    if (prismaError.code !== 'P2002') {
      return false;
    }

    const target = prismaError.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('organizationId') && target.includes('code');
    }

    return (
      typeof target === 'string' &&
      target.includes('organizationId') &&
      target.includes('code')
    );
  }
}
