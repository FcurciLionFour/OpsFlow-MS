import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { LoginAttemptService } from './login-attempt.service';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { resolveRuntimeRole, uniqueStrings } from './auth-context.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private loginAttemptService: LoginAttemptService,
  ) {}

  /* ---------------- REGISTER / LOGIN ---------------- */

  async register(email: string, password: string, meta?: SessionMeta) {
    const organizationId = await this.ensureDefaultOrganizationId();
    const operatorRoleId = await this.ensureOperatorRoleId();
    const hashedPassword = await bcrypt.hash(password, 10);

    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: {
          organizationId,
          branchId: null,
          email,
          password: hashedPassword,
          isActive: true,
          roles: {
            create: {
              role: {
                connect: { id: operatorRoleId },
              },
            },
          },
        },
        select: {
          id: true,
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

    return this.createSession(user.id, meta);
  }

  async login(email: string, password: string, meta?: SessionMeta) {
    const ip = meta?.ip;
    await this.loginAttemptService.assertNotLocked(email, ip);

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await this.loginAttemptService.recordFailure(email, ip);
      await this.loginAttemptService.assertNotLocked(email, ip);
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await this.loginAttemptService.recordFailure(email, ip);
      await this.loginAttemptService.assertNotLocked(email, ip);
      throw new UnauthorizedException({
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
    }

    await this.loginAttemptService.recordSuccess(email, ip);

    return this.createSession(user.id, meta);
  }

  /* ---------------- REFRESH ---------------- */

  async refresh(refreshToken: string, meta?: SessionMeta) {
    let payload: { sid: string };

    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: { isActive: true },
        },
      },
    });

    if (
      !session ||
      !session.user.isActive ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }

    const valid = await bcrypt.compare(
      refreshToken,
      session.hashedRefreshToken,
    );

    // Reuse detection.
    if (!valid) {
      await this.prisma.authSession.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });

      throw new ForbiddenException({
        code: ErrorCodes.AUTH_REFRESH_REUSE_DETECTED,
        message: 'Refresh token reuse detected',
      });
    }

    return this.createSession(session.userId, meta, session.id);
  }

  /* ---------------- LOGOUT ---------------- */

  async logout(refreshToken: string) {
    if (!refreshToken) {
      return; // idempotent logout
    }

    let payload: { sid: string };

    try {
      payload = this.jwt.verify<{ sid: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      return;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
    });

    if (!session || session.revokedAt) {
      return;
    }

    const valid = await bcrypt.compare(
      refreshToken,
      session.hashedRefreshToken,
    );
    if (!valid) {
      return;
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }

  /* ---------------- CORE ---------------- */

  private async createSession(
    userId: string,
    meta?: SessionMeta,
    replacedSessionId?: string,
  ) {
    const sessionId = randomUUID();

    const payload = {
      sub: userId,
      sid: sessionId,
    };

    const accessToken = this.jwt.sign(payload);

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: (this.config.get<string>('jwt.refreshExpiresIn') ??
        '7d') as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    const refreshMaxAgeMs =
      this.config.get<number>('cookies.refreshMaxAgeMs') ??
      7 * 24 * 60 * 60 * 1000;

    const nextSessionData = {
      id: sessionId,
      userId,
      hashedRefreshToken,
      expiresAt: new Date(Date.now() + refreshMaxAgeMs),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    };

    if (!replacedSessionId) {
      await this.prisma.authSession.create({
        data: nextSessionData,
      });
    } else {
      const rotationTimestamp = new Date();
      await this.prisma.$transaction([
        this.prisma.authSession.create({
          data: nextSessionData,
        }),
        this.prisma.authSession.update({
          where: { id: replacedSessionId },
          data: {
            revokedAt: rotationTimestamp,
            lastUsedAt: rotationTimestamp,
            replacedById: sessionId,
          },
        }),
      ]);
    }

    return { accessToken, refreshToken };
  }

  async getSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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

    const roles = await this.prisma.userRole.findMany({
      where: { userId },
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

    const roleNames = uniqueStrings(roles.map((r) => r.role.name));
    const permissions = uniqueStrings(
      roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
    );
    const role = resolveRuntimeRole(roleNames);

    return {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        branchId: user.branchId,
        role,
      },
      role,
      roles: roleNames,
      permissions,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return a neutral response.
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    const tokenHash = this.hashToken(token);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    // Hook for mailer implementation.
    // link: `${FRONT_URL}/auth/reset-password?token=${token}`

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new ForbiddenException({
        code: ErrorCodes.AUTH_INVALID_OR_EXPIRED_RESET_TOKEN,
        message: 'Invalid or expired token',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashed },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.authSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCodes.ACCESS_DENIED,
        message: 'Forbidden',
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new ForbiddenException({
        code: ErrorCodes.AUTH_INVALID_CURRENT_PASSWORD,
        message: 'Invalid current password',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      }),
      this.prisma.authSession.deleteMany({
        where: { userId },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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

  private async ensureDefaultOrganizationId(): Promise<string> {
    const defaultOrgSlug = (
      process.env.SEED_ORG_SLUG?.trim().toLowerCase() || 'default-org'
    ).slice(0, 64);
    const defaultOrgName =
      process.env.SEED_ORG_NAME?.trim() || 'Default Organization';

    const organization = await this.prisma.organization.upsert({
      where: { slug: defaultOrgSlug },
      update: {
        name: defaultOrgName,
        isActive: true,
      },
      create: {
        name: defaultOrgName,
        slug: defaultOrgSlug,
        isActive: true,
      },
      select: { id: true },
    });

    return organization.id;
  }

  private async ensureOperatorRoleId(): Promise<string> {
    const role = await this.prisma.role.upsert({
      where: { name: 'OPERATOR' },
      update: {},
      create: {
        name: 'OPERATOR',
        description: 'Branch operator',
      },
      select: { id: true },
    });

    return role.id;
  }
}

/* -------- TYPES -------- */

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}
