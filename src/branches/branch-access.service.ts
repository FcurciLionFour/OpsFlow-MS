import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { BranchesRepository } from './branches.repository';

@Injectable()
export class BranchAccessService {
  private readonly branchesRepository: BranchesRepository;

  constructor(private readonly prisma: PrismaService) {
    this.branchesRepository = new BranchesRepository(prisma);
  }

  async resolveBranchForCreate(
    currentUser: AuthenticatedUserContext,
    requestedBranchId?: string,
  ): Promise<string> {
    if (currentUser.role === 'OPERATOR') {
      const branchId = this.requireScopedBranch(currentUser);
      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        branchId,
        true,
      );
      return branchId;
    }

    if (currentUser.role === 'MANAGER' && currentUser.branchId) {
      if (requestedBranchId && requestedBranchId !== currentUser.branchId) {
        await this.assertBranchExistsInOrganization(
          currentUser.organizationId,
          requestedBranchId,
        );
        throw new ForbiddenException({
          code: ErrorCodes.ACCESS_DENIED,
          message: 'Access denied',
        });
      }

      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        currentUser.branchId,
        true,
      );
      return currentUser.branchId;
    }

    if (!requestedBranchId) {
      throw new BadRequestException({
        code: ErrorCodes.BRANCH_SCOPE_REQUIRED,
        message: 'branchId is required for this operation',
      });
    }

    await this.assertBranchExistsInOrganization(
      currentUser.organizationId,
      requestedBranchId,
      true,
    );
    return requestedBranchId;
  }

  async resolveBranchForFilter(
    currentUser: AuthenticatedUserContext,
    requestedBranchId?: string,
  ): Promise<string | null> {
    if (currentUser.role === 'OPERATOR') {
      const branchId = this.requireScopedBranch(currentUser);
      if (requestedBranchId && requestedBranchId !== branchId) {
        await this.assertBranchExistsInOrganization(
          currentUser.organizationId,
          requestedBranchId,
        );
        throw new ForbiddenException({
          code: ErrorCodes.ACCESS_DENIED,
          message: 'Access denied',
        });
      }

      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        branchId,
      );
      return branchId;
    }

    if (currentUser.role === 'MANAGER' && currentUser.branchId) {
      if (requestedBranchId && requestedBranchId !== currentUser.branchId) {
        await this.assertBranchExistsInOrganization(
          currentUser.organizationId,
          requestedBranchId,
        );
        throw new ForbiddenException({
          code: ErrorCodes.ACCESS_DENIED,
          message: 'Access denied',
        });
      }

      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        currentUser.branchId,
      );
      return currentUser.branchId;
    }

    if (!requestedBranchId) {
      return null;
    }

    await this.assertBranchExistsInOrganization(
      currentUser.organizationId,
      requestedBranchId,
    );
    return requestedBranchId;
  }

  async assertBranchAccessible(
    currentUser: AuthenticatedUserContext,
    branchId: string,
  ): Promise<void> {
    const forcedBranchId = await this.resolveBranchForFilter(currentUser);
    if (forcedBranchId && forcedBranchId !== branchId) {
      throw new ForbiddenException({
        code: ErrorCodes.ACCESS_DENIED,
        message: 'Access denied',
      });
    }

    if (!forcedBranchId) {
      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        branchId,
      );
    }
  }

  async getAccessibleBranches(
    currentUser: AuthenticatedUserContext,
  ): Promise<string[] | null> {
    if (currentUser.role === 'OPERATOR') {
      const branchId = this.requireScopedBranch(currentUser);
      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        branchId,
      );
      return [branchId];
    }

    if (currentUser.role === 'MANAGER' && currentUser.branchId) {
      await this.assertBranchExistsInOrganization(
        currentUser.organizationId,
        currentUser.branchId,
      );
      return [currentUser.branchId];
    }

    const branches = await this.branchesRepository.list(
      currentUser.organizationId,
      {
        includeInactive: false,
      },
    );
    return branches.map((branch) => branch.id);
  }

  private requireScopedBranch(currentUser: AuthenticatedUserContext): string {
    if (currentUser.branchId) {
      return currentUser.branchId;
    }

    throw new ForbiddenException({
      code: ErrorCodes.BRANCH_SCOPE_REQUIRED,
      message: 'User branch scope is required',
    });
  }

  private async assertBranchExistsInOrganization(
    organizationId: string,
    branchId: string,
    requireActive = false,
  ): Promise<void> {
    const branch = await this.branchesRepository.findById(
      organizationId,
      branchId,
    );

    if (!branch || (requireActive && !branch.isActive)) {
      throw new NotFoundException({
        code: ErrorCodes.BRANCH_NOT_FOUND,
        message: 'Branch not found',
      });
    }
  }
}
