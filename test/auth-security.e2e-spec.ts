/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request, { type Response } from 'supertest';
import { AuthModule } from 'src/auth/auth.module';
import { JwtGlobalGuard } from 'src/auth/guards/jwt-global.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';

type RoleName = 'ADMIN' | 'USER';
type PermissionKey = 'users.read' | 'users.write';

interface UserRecord {
  id: string;
  email: string;
  password: string;
  isActive: boolean;
}

interface SessionRecord {
  id: string;
  userId: string;
  hashedRefreshToken: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  revokedAt: Date | null;
  replacedById: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface ResetTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
}

@Controller('rbac')
@UseGuards(PermissionsGuard)
class RbacTestController {
  @RequirePermissions('users.read')
  @Get('users-read')
  usersRead() {
    return { ok: true };
  }
}

function pickSelected<T extends object>(
  input: T,
  select?: Record<string, boolean>,
): Partial<T> {
  if (!select) {
    return input;
  }

  const out: Partial<T> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      out[key as keyof T] = input[key as keyof T];
    }
  }
  return out;
}

function createPrismaMock() {
  const users = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, string>();
  const sessions = new Map<string, SessionRecord>();
  const resetTokens = new Map<string, ResetTokenRecord>();
  const userRoles = new Map<string, Set<RoleName>>();
  const rolePermissions: Record<RoleName, PermissionKey[]> = {
    ADMIN: ['users.read', 'users.write'],
    USER: [],
  };

  const mock = {
    user: {
      create: jest.fn(async ({ data }: { data: any }) => {
        if (usersByEmail.has(data.email)) {
          throw new Error('Unique constraint failed on email');
        }

        const id = randomUUID();
        const user: UserRecord = {
          id,
          email: data.email as string,
          password: data.password as string,
          isActive: data.isActive ?? true,
        };
        users.set(id, user);
        usersByEmail.set(user.email, id);

        const roleName = data.roles?.create?.role?.connect?.name as
          | RoleName
          | undefined;
        if (roleName) {
          userRoles.set(id, new Set([roleName]));
        } else {
          userRoles.set(id, new Set());
        }

        return user;
      }),
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: string; email?: string };
          select?: Record<string, boolean>;
        }) => {
          const userId =
            where.id ??
            (where.email ? usersByEmail.get(where.email) : undefined);
          if (!userId) {
            return null;
          }

          const user = users.get(userId);
          if (!user) {
            return null;
          }

          return pickSelected(user, select);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<UserRecord>;
        }) => {
          const current = users.get(where.id);
          if (!current) {
            throw new Error('User not found');
          }
          const next: UserRecord = {
            ...current,
            ...data,
          };
          users.set(where.id, next);
          return next;
        },
      ),
    },
    authSession: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const session: SessionRecord = {
          id: data.id,
          userId: data.userId,
          hashedRefreshToken: data.hashedRefreshToken,
          expiresAt: data.expiresAt,
          ip: data.ip,
          userAgent: data.userAgent,
          revokedAt: null,
          replacedById: data.replacedById ?? null,
          lastUsedAt: null,
          createdAt: new Date(),
        };
        sessions.set(session.id, session);
        return session;
      }),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: any;
        }) => {
          const session = sessions.get(where.id);
          if (!session) {
            return null;
          }

          if (include?.user) {
            const user = users.get(session.userId);
            return {
              ...session,
              user: user ? pickSelected(user, include.user.select) : null,
            };
          }

          return session;
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SessionRecord>;
        }) => {
          const session = sessions.get(where.id);
          if (!session) {
            throw new Error('Session not found');
          }
          const next: SessionRecord = {
            ...session,
            ...data,
            revokedAt: data.revokedAt ?? session.revokedAt,
            lastUsedAt: data.lastUsedAt ?? session.lastUsedAt,
          };
          sessions.set(where.id, next);
          return next;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { userId: string };
          data: Partial<SessionRecord>;
        }) => {
          let count = 0;
          for (const [id, session] of sessions.entries()) {
            if (session.userId !== where.userId) {
              continue;
            }
            sessions.set(id, {
              ...session,
              ...data,
              revokedAt: data.revokedAt ?? session.revokedAt,
            });
            count += 1;
          }
          return { count };
        },
      ),
      deleteMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        let count = 0;
        for (const [id, session] of sessions.entries()) {
          if (session.userId === where.userId) {
            sessions.delete(id);
            count += 1;
          }
        }
        return { count };
      }),
    },
    userRole: {
      findMany: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { userId: string };
          include?: any;
        }) => {
          const roles = [
            ...(userRoles.get(where.userId) ?? new Set<RoleName>()),
          ];
          if (!include?.role) {
            return roles.map((name) => ({ role: { name } }));
          }

          return roles.map((name) => ({
            role: {
              name,
              permissions: rolePermissions[name].map((key) => ({
                permission: { key },
              })),
            },
          }));
        },
      ),
    },
    passwordResetToken: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const id = randomUUID();
        const token: ResetTokenRecord = {
          id,
          userId: data.userId,
          token: data.token,
          expiresAt: data.expiresAt,
          usedAt: null,
        };
        resetTokens.set(token.token, token);
        return token;
      }),
      findUnique: jest.fn(async ({ where }: { where: { token: string } }) => {
        return resetTokens.get(where.token) ?? null;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ResetTokenRecord>;
        }) => {
          for (const token of resetTokens.values()) {
            if (token.id === where.id) {
              token.usedAt = data.usedAt ?? token.usedAt;
              return token;
            }
          }
          throw new Error('Reset token not found');
        },
      ),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    __helpers: {
      setRolesByEmail(email: string, roles: RoleName[]) {
        const userId = usersByEmail.get(email);
        if (!userId) {
          throw new Error(`User not found: ${email}`);
        }
        userRoles.set(userId, new Set(roles));
      },
    },
  };

  return mock;
}

function readCookie(res: Response, cookieName: string): string {
  const cookies = res.headers['set-cookie'] ?? [];
  for (const cookie of cookies) {
    if (!cookie.startsWith(`${cookieName}=`)) {
      continue;
    }
    return cookie.split(';')[0].split('=')[1];
  }
  throw new Error(`Cookie not found: ${cookieName}`);
}

describe('Auth Security (e2e)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    RateLimitGuard.resetForTests();
    prismaMock = createPrismaMock();

    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              nodeEnv: 'test',
              port: 0,
              corsOrigins: ['http://localhost:4200'],
              jwt: {
                accessSecret: 'access-secret-with-minimum-32-characters',
                refreshSecret: 'refresh-secret-with-minimum-32-characters',
                accessExpiresIn: '15m',
                refreshExpiresIn: '7d',
              },
              cookies: {
                sameSite: 'lax',
                secure: false,
                csrfMaxAgeMs: 7200000,
                refreshMaxAgeMs: 604800000,
              },
              loginProtection: {
                enabled: true,
                maxFailures: 5,
                windowMs: 900000,
                baseLockMs: 60000,
                maxLockMs: 1800000,
              },
            }),
          ],
        }),
        PrismaModule,
        AuthModule,
      ],
      controllers: [RbacTestController],
      providers: [
        PermissionsGuard,
        {
          provide: APP_GUARD,
          useClass: JwtGlobalGuard,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock);

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('blocks refresh without CSRF token', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({ email: 'user1@test.com', password: 'Password123' })
      .expect(201);

    await agent
      .post('/auth/login')
      .send({ email: 'user1@test.com', password: 'Password123' })
      .expect(200);

    await agent.post('/auth/refresh').expect(403);
  });

  it('rejects stale refresh token after rotation', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({ email: 'reuse@test.com', password: 'Password123' })
      .expect(201);

    const loginRes = await agent
      .post('/auth/login')
      .send({ email: 'reuse@test.com', password: 'Password123' })
      .expect(200);

    const oldRefreshToken = readCookie(loginRes, 'refresh_token');

    const csrfRes = await agent.get('/auth/csrf').expect(200);
    const csrfToken = readCookie(csrfRes, 'csrf_token');

    await agent
      .post('/auth/refresh')
      .set('x-csrf-token', csrfToken)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-csrf-token', csrfToken)
      .set(
        'Cookie',
        [`refresh_token=${oldRefreshToken}`, `csrf_token=${csrfToken}`].join(
          '; ',
        ),
      )
      .expect(401);
  });

  it('invalidates refresh after logout', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({ email: 'logout@test.com', password: 'Password123' })
      .expect(201);

    const loginRes = await agent
      .post('/auth/login')
      .send({ email: 'logout@test.com', password: 'Password123' })
      .expect(200);
    const { accessToken } = loginRes.body as { accessToken: string };
    expect(accessToken).toBeDefined();

    const csrfRes = await agent.get('/auth/csrf').expect(200);
    const csrfToken = readCookie(csrfRes, 'csrf_token');

    await agent.post('/auth/logout').set('x-csrf-token', csrfToken).expect(204);

    await agent
      .post('/auth/refresh')
      .set('x-csrf-token', csrfToken)
      .expect(401);
  });

  it('enforces login lockout after repeated credential failures', async () => {
    const agent = request.agent(app.getHttpServer());

    for (let i = 0; i < 4; i += 1) {
      await agent
        .post('/auth/login')
        .send({ email: 'no-user@test.com', password: 'WrongPass123' })
        .expect(401);
    }

    const lockedResponse = await agent
      .post('/auth/login')
      .send({ email: 'no-user@test.com', password: 'WrongPass123' })
      .expect(429);

    expect(lockedResponse.body.code).toBe('AUTH_LOGIN_LOCKED');
    expect(typeof lockedResponse.body.retryAfterSeconds).toBe('number');
  });

  it('denies RBAC endpoint without JWT', async () => {
    await request(app.getHttpServer()).get('/rbac/users-read').expect(401);
  });

  it('denies RBAC endpoint for USER role and allows ADMIN', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({ email: 'rbac@test.com', password: 'Password123' })
      .expect(201);

    const userLoginRes = await agent
      .post('/auth/login')
      .send({ email: 'rbac@test.com', password: 'Password123' })
      .expect(200);

    const userAccessToken = userLoginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/rbac/users-read')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .expect(403);

    prismaMock.__helpers.setRolesByEmail('rbac@test.com', ['ADMIN']);

    const adminLoginRes = await agent
      .post('/auth/login')
      .send({ email: 'rbac@test.com', password: 'Password123' })
      .expect(200);

    const adminAccessToken = adminLoginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/rbac/users-read')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
  });
});
