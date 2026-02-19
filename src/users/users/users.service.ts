import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: u.roles.map((ur) => ur.role.name),
    }));
  }

  async findById(
    id: string,
    requesterId: string,
  ): Promise<UserResponseDto | null> {
    await this.assertCanAccessUser(id, requesterId);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  async create(data: CreateUserDto) {
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

    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: data.roles,
        },
      },
    });

    if (roles.length !== data.roles.length) {
      throw new ForbiddenException({
        code: ErrorCodes.USER_INVALID_ROLE,
        message: 'One or more roles are invalid',
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let user: {
      id: string;
      email: string;
      roles: Array<{ role: { name: string } }>;
    };
    try {
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          // Hash password here too for admin-driven user creation.
          password: hashedPassword,
          isActive: true,
          roles: {
            create: roles.map((role) => ({
              role: {
                connect: { id: role.id },
              },
            })),
          },
        },
        select: {
          id: true,
          email: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    } catch (error: unknown) {
      if (this.isEmailUniqueViolation(error)) {
        throw new ForbiddenException({
          code: ErrorCodes.USER_ALREADY_EXISTS,
          message: 'User already exists',
        });
      }

      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  async update(id: string, data: UpdateUserDto, requesterId: string) {
    await this.assertCanAccessUser(id, requesterId);

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    const { roles, ...userData } = data;

    if (Object.keys(userData).length > 0) {
      try {
        await this.prisma.user.update({
          where: { id },
          data: userData,
        });
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

      const dbRoles = await this.prisma.role.findMany({
        where: {
          name: { in: roles },
        },
      });

      if (dbRoles.length !== roles.length) {
        throw new ForbiddenException({
          code: ErrorCodes.USER_INVALID_ROLE,
          message: 'One or more roles are invalid',
        });
      }

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

    const updated = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return {
      id: updated!.id,
      email: updated!.email,
      isActive: updated!.isActive,
      roles: updated!.roles.map((ur) => ur.role.name),
    };
  }

  async remove(id: string, requesterId: string) {
    await this.assertCanAccessUser(id, requesterId);
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return { success: true };
  }

  private async assertCanAccessUser(
    targetUserId: string,
    requesterUserId: string,
  ): Promise<void> {
    const isAdmin = await this.prisma.userRole.findFirst({
      where: {
        userId: requesterUserId,
        role: {
          name: 'ADMIN',
        },
      },
    });

    if (isAdmin) {
      return;
    }

    if (targetUserId === requesterUserId) {
      return;
    }

    throw new ForbiddenException({
      code: ErrorCodes.ACCESS_DENIED,
      message: 'Access denied',
    });
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
