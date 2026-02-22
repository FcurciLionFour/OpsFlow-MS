import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveRuntimeRole, uniqueStrings } from '../auth-context.util';
import { ErrorCodes } from 'src/common/errors/error-codes';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: string; sid?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isActive: true,
        organizationId: true,
        branchId: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_USER_INACTIVE,
        message: 'Unauthorized',
      });
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const roleNames = uniqueStrings(userRoles.map((ur) => ur.role.name));
    const permissions = uniqueStrings(
      userRoles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.key),
      ),
    );

    return {
      sub: user.id,
      id: user.id,
      sid: payload.sid,
      organizationId: user.organizationId,
      branchId: user.branchId,
      role: resolveRuntimeRole(roleNames),
      roles: roleNames,
      permissions,
    };
  }
}
