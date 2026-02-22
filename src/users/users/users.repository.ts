import { PrismaService } from 'src/prisma/prisma.service';
import type { OrganizationScopedRepository } from 'src/common/tenancy/organization-scoped.repository';
import { assertOrganizationAccess } from 'src/common/tenancy/tenant-scope.util';

const userSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  email: true,
  roles: {
    include: {
      role: true,
    },
  },
} as const;

type UserRecord = {
  id: string;
  organizationId: string;
  branchId: string | null;
  email: string;
  roles: Array<{ role: { name: string } }>;
};

export type UsersListFilters = {
  isActive?: boolean;
};

export type UserCreateInput = {
  branchId: string | null;
  email: string;
  password: string;
  isActive: boolean;
  roles: {
    create: Array<{
      role: {
        connect: { id: string };
      };
    }>;
  };
};

export type UserUpdateInput = {
  email?: string;
  isActive?: boolean;
  branchId?: string | null;
};

export class UsersRepository implements OrganizationScopedRepository<
  UserRecord,
  UsersListFilters,
  UserCreateInput
> {
  constructor(private readonly prisma: PrismaService) {}

  list(
    organizationId: string,
    filters: UsersListFilters,
  ): Promise<UserRecord[]> {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        ...(filters.isActive === undefined
          ? {}
          : { isActive: filters.isActive }),
      },
      select: userSelect,
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<UserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    assertOrganizationAccess(user.organizationId, organizationId);
    return user;
  }

  create(organizationId: string, data: UserCreateInput): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        organizationId,
        ...data,
      },
      select: userSelect,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: UserUpdateInput,
  ): Promise<UserRecord | null> {
    await this.prisma.user.updateMany({
      where: {
        id,
        organizationId,
      },
      data,
    });

    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string): Promise<boolean> {
    const updated = await this.prisma.user.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        isActive: false,
      },
    });

    if (updated.count > 0) {
      return true;
    }

    const user = await this.findById(organizationId, id);
    return !!user;
  }
}
