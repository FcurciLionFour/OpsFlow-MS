import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuthenticatedUserContext,
  resolveRuntimeRole,
  uniqueStrings,
} from 'src/auth/auth-context.util';
import { BranchesRepository } from 'src/branches/branches.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly usersRepository: UsersRepository;
  private readonly branchesRepository: BranchesRepository;

  constructor(private prisma: PrismaService) {
    this.usersRepository = new UsersRepository(prisma);
    this.branchesRepository = new BranchesRepository(prisma);
  }

  async findAll(
    currentUser: AuthenticatedUserContext,
  ): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.list(currentUser.organizationId, {
      isActive: true,
    });

    return users.map((user) => this.mapUserResponse(user));
  }

  async findById(
    id: string,
    currentUser: AuthenticatedUserContext,
  ): Promise<UserResponseDto> {
    await this.assertCanAccessUser(id, currentUser);

    const user = await this.usersRepository.findById(
      currentUser.organizationId,
      id,
    );

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    return this.mapUserResponse(user);
  }

  async create(data: CreateUserDto, currentUser: AuthenticatedUserContext) {
    this.assertCanManageUsers(currentUser);

    const exists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (exists) {
      throw new ForbiddenException({
        code: ErrorCodes.USER_ALREADY_EXISTS,
        message: 'User already exists',
      });
    }

    if (!data.roles || data.roles.length === 0) {
      throw new ForbiddenException({
        code: ErrorCodes.USER_ROLE_REQUIRED,
        message: 'At least one role is required',
      });
    }

    const dbRoles = await this.loadRoles(data.roles);
    const branchId = await this.resolveBranchId(
      data.branchId,
      currentUser.organizationId,
    );

    const hashedPassword = await bcrypt.hash(data.password, 10);

    try {
      const user = await this.usersRepository.create(
        currentUser.organizationId,
        {
          branchId,
          email: data.email,
          password: hashedPassword,
          isActive: true,
          roles: {
            create: dbRoles.map((role) => ({
              role: {
                connect: { id: role.id },
              },
            })),
          },
        },
      );

      return this.mapUserResponse(user);
    } catch (error: unknown) {
      if (this.isEmailUniqueViolation(error)) {
        throw new ForbiddenException({
          code: ErrorCodes.USER_ALREADY_EXISTS,
          message: 'User already exists',
        });
      }

      throw error;
    }
  }

  async update(
    id: string,
    data: UpdateUserDto,
    currentUser: AuthenticatedUserContext,
  ) {
    await this.assertCanAccessUser(id, currentUser);

    const user = await this.usersRepository.findById(
      currentUser.organizationId,
      id,
    );

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    const { roles, branchId, ...userData } = data;
    const updateData: {
      email?: string;
      isActive?: boolean;
      branchId?: string | null;
    } = {
      ...userData,
    };

    if (branchId !== undefined) {
      updateData.branchId = await this.resolveBranchId(
        branchId,
        currentUser.organizationId,
      );
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await this.usersRepository.update(
          currentUser.organizationId,
          id,
          updateData,
        );
      } catch (error: unknown) {
        if (this.isEmailUniqueViolation(error)) {
          throw new ForbiddenException({
            code: ErrorCodes.USER_ALREADY_EXISTS,
            message: 'User already exists',
          });
        }

        throw error;
      }
    }

    if (roles) {
      if (roles.length === 0) {
        throw new ForbiddenException({
          code: ErrorCodes.USER_ROLE_REQUIRED,
          message: 'User must have at least one role',
        });
      }

      const dbRoles = await this.loadRoles(roles);

      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      await this.prisma.userRole.createMany({
        data: dbRoles.map((role) => ({
          userId: id,
          roleId: role.id,
        })),
      });
    }

    const updated = await this.usersRepository.findById(
      currentUser.organizationId,
      id,
    );

    if (!updated) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    return this.mapUserResponse(updated);
  }

  async remove(id: string, currentUser: AuthenticatedUserContext) {
    await this.assertCanAccessUser(id, currentUser);

    const wasDeleted = await this.usersRepository.softDelete(
      currentUser.organizationId,
      id,
    );

    if (!wasDeleted) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    return { success: true };
  }

  private assertCanManageUsers(currentUser: AuthenticatedUserContext): void {
    if (currentUser.role === 'ADMIN') {
      return;
    }

    throw new ForbiddenException({
      code: ErrorCodes.ACCESS_DENIED,
      message: 'Access denied',
    });
  }

  private async assertCanAccessUser(
    targetUserId: string,
    currentUser: AuthenticatedUserContext,
  ): Promise<void> {
    const target = await this.usersRepository.findById(
      currentUser.organizationId,
      targetUserId,
    );

    if (!target) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    if (currentUser.role === 'ADMIN') {
      return;
    }

    if (target.id === currentUser.id) {
      return;
    }

    throw new ForbiddenException({
      code: ErrorCodes.ACCESS_DENIED,
      message: 'Access denied',
    });
  }

  private async loadRoles(roleNames: string[]) {
    const dbRoles = await this.prisma.role.findMany({
      where: {
        name: {
          in: roleNames,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (dbRoles.length !== roleNames.length) {
      throw new ForbiddenException({
        code: ErrorCodes.USER_INVALID_ROLE,
        message: 'One or more roles are invalid',
      });
    }

    return dbRoles;
  }

  private async resolveBranchId(
    branchId: string | null | undefined,
    organizationId: string,
  ): Promise<string | null> {
    if (!branchId) {
      return null;
    }

    const branch = await this.branchesRepository.findById(
      organizationId,
      branchId,
    );

    if (!branch) {
      throw new NotFoundException({
        code: ErrorCodes.BRANCH_NOT_FOUND,
        message: 'Branch not found',
      });
    }

    return branch.id;
  }

  private mapUserResponse(user: {
    id: string;
    organizationId: string;
    branchId: string | null;
    email: string;
    roles: Array<{ role: { name: string } }>;
  }): UserResponseDto {
    const roleNames = uniqueStrings(user.roles.map((ur) => ur.role.name));

    return {
      id: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      role: resolveRuntimeRole(roleNames),
      email: user.email,
      roles: roleNames,
    };
  }

  private isEmailUniqueViolation(error: unknown): boolean {
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
      return target.includes('email');
    }

    return typeof target === 'string' && target.includes('email');
  }
}
