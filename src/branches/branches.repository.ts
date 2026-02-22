import { PrismaService } from 'src/prisma/prisma.service';
import type { OrganizationScopedRepository } from 'src/common/tenancy/organization-scoped.repository';
import { assertOrganizationAccess } from 'src/common/tenancy/tenant-scope.util';

const branchSelect = {
  id: true,
  organizationId: true,
  name: true,
  code: true,
  isActive: true,
} as const;

type BranchRecord = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type BranchListFilters = {
  includeInactive?: boolean;
};

export type BranchCreateInput = {
  name: string;
  code: string;
  isActive: boolean;
};

export type BranchUpdateInput = {
  name?: string;
  isActive?: boolean;
};

export class BranchesRepository implements OrganizationScopedRepository<
  BranchRecord,
  BranchListFilters,
  BranchCreateInput
> {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    organizationId: string,
    id: string,
  ): Promise<BranchRecord | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id },
      select: branchSelect,
    });

    if (!branch) {
      return null;
    }

    assertOrganizationAccess(branch.organizationId, organizationId);
    return branch;
  }

  list(
    organizationId: string,
    filters: BranchListFilters,
  ): Promise<BranchRecord[]> {
    return this.prisma.branch.findMany({
      where: {
        organizationId,
        ...(filters.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ name: 'asc' }],
      select: branchSelect,
    });
  }

  create(
    organizationId: string,
    data: BranchCreateInput,
  ): Promise<BranchRecord> {
    return this.prisma.branch.create({
      data: {
        organizationId,
        ...data,
      },
      select: branchSelect,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: BranchUpdateInput,
  ): Promise<BranchRecord | null> {
    const branch = await this.findById(organizationId, id);
    if (!branch) {
      return null;
    }

    return this.prisma.branch.update({
      where: { id },
      data,
      select: branchSelect,
    });
  }
}
