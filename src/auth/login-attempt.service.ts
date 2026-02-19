import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from 'src/common/errors/error-codes';

interface LoginAttemptRecord {
  failures: number;
  lastFailureAt: number;
  lockUntil: number;
}

@Injectable()
export class LoginAttemptService implements OnModuleInit, OnModuleDestroy {
  private readonly attempts = new Map<string, LoginAttemptRecord>();
  private lastMemoryCleanupAt = 0;
  private readonly memoryCleanupIntervalMs = 60_000;
  private readonly logger = new Logger(LoginAttemptService.name);
  private redisClient: null | {
    connect: () => Promise<void>;
    quit: () => Promise<void>;
    get: (key: string) => Promise<string | null>;
    del: (...keys: string[]) => Promise<number>;
    eval: (script: string, options: unknown) => Promise<number>;
  } = null;
  private redisEnabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl =
      this.config.get<string>('loginProtection.redisUrl') ??
      this.config.get<string>('rateLimit.redisUrl') ??
      process.env.LOGIN_LOCK_REDIS_URL ??
      process.env.RATE_LIMIT_REDIS_URL;

    if (!redisUrl) {
      return;
    }

    try {
      const redisPackage = process.env.RATE_LIMIT_REDIS_PACKAGE ?? 'redis';
      const redis = (await import(redisPackage)) as {
        createClient: (opts: { url: string }) => {
          connect: () => Promise<void>;
          quit: () => Promise<void>;
          get: (key: string) => Promise<string | null>;
          del: (...keys: string[]) => Promise<number>;
          eval: (
            script: string,
            options: { keys: string[]; arguments: string[] },
          ) => Promise<number>;
        };
      };

      const client = redis.createClient({ url: redisUrl });
      await client.connect();
      this.redisClient = client;
      this.redisEnabled = true;
      this.logger.log('Login lock store initialized with Redis');
    } catch (error) {
      this.redisClient = null;
      this.redisEnabled = false;
      const reason =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(
        `Redis login lock disabled; using in-memory fallback. Reason: ${reason}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    await this.redisClient.quit();
    this.redisClient = null;
    this.redisEnabled = false;
  }

  async assertNotLocked(email: string, ip?: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const now = Date.now();
    const key = this.buildKey(email, ip);

    if (this.redisEnabled && this.redisClient) {
      const lockUntilRaw = await this.redisClient.get(this.lockKey(key));
      if (lockUntilRaw) {
        const lockUntil = Number(lockUntilRaw);
        if (Number.isFinite(lockUntil) && lockUntil > now) {
          this.throwLocked(lockUntil, now);
        }
      }
      return;
    }

    this.cleanupExpiredAttempts(now);
    const current = this.attempts.get(key);

    if (!current) {
      return;
    }

    if (current.lockUntil > now) {
      this.throwLocked(current.lockUntil, now);
    }

    const windowMs = this.getWindowMs();
    if (now - current.lastFailureAt > windowMs) {
      this.attempts.delete(key);
    }
  }

  async recordSuccess(email: string, ip?: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const key = this.buildKey(email, ip);

    if (this.redisEnabled && this.redisClient) {
      await this.redisClient.del(this.failureKey(key), this.lockKey(key));
      return;
    }

    this.attempts.delete(key);
  }

  async recordFailure(email: string, ip?: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const now = Date.now();
    const key = this.buildKey(email, ip);
    const maxFailures = this.getMaxFailures();
    const windowMs = this.getWindowMs();
    const baseLockMs = this.getBaseLockMs();
    const maxLockMs = this.getMaxLockMs();

    if (this.redisEnabled && this.redisClient) {
      const script = [
        'local now = tonumber(ARGV[1])',
        'local windowMs = tonumber(ARGV[2])',
        'local maxFailures = tonumber(ARGV[3])',
        'local baseLockMs = tonumber(ARGV[4])',
        'local maxLockMs = tonumber(ARGV[5])',
        'local failures = redis.call("INCR", KEYS[1])',
        'if failures == 1 then redis.call("PEXPIRE", KEYS[1], windowMs) end',
        'if failures >= maxFailures then',
        '  local lockStage = failures - maxFailures',
        '  local lockMs = baseLockMs * (2 ^ lockStage)',
        '  if lockMs > maxLockMs then lockMs = maxLockMs end',
        '  local lockUntil = now + lockMs',
        '  redis.call("SET", KEYS[2], tostring(lockUntil), "PX", lockMs)',
        'end',
        'return failures',
      ].join('\n');

      await this.redisClient.eval(script, {
        keys: [this.failureKey(key), this.lockKey(key)],
        arguments: [
          now.toString(),
          windowMs.toString(),
          maxFailures.toString(),
          baseLockMs.toString(),
          maxLockMs.toString(),
        ],
      });
      return;
    }

    this.cleanupExpiredAttempts(now);
    const current = this.attempts.get(key);

    const nextFailures =
      current && now - current.lastFailureAt <= windowMs
        ? current.failures + 1
        : 1;

    let lockUntil = current?.lockUntil ?? 0;
    if (nextFailures >= maxFailures) {
      const lockStage = nextFailures - maxFailures;
      const lockMs = Math.min(baseLockMs * 2 ** lockStage, maxLockMs);
      lockUntil = now + lockMs;
    }

    this.attempts.set(key, {
      failures: nextFailures,
      lastFailureAt: now,
      lockUntil,
    });
  }

  resetForTests(): void {
    this.attempts.clear();
    this.lastMemoryCleanupAt = 0;
  }

  private throwLocked(lockUntil: number, now: number): void {
    const retryAfterSeconds = Math.max(1, Math.ceil((lockUntil - now) / 1000));
    throw new HttpException(
      {
        code: ErrorCodes.AUTH_LOGIN_LOCKED,
        message: 'Too many failed login attempts',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private failureKey(key: string): string {
    return `login_lock:failures:${key}`;
  }

  private lockKey(key: string): string {
    return `login_lock:lock_until:${key}`;
  }

  private buildKey(email: string, ip?: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedIp = (ip ?? 'unknown').trim() || 'unknown';
    return `${normalizedIp}|${normalizedEmail}`;
  }

  private isEnabled(): boolean {
    return this.config.get<boolean>('loginProtection.enabled') ?? true;
  }

  private getMaxFailures(): number {
    return this.config.get<number>('loginProtection.maxFailures') ?? 5;
  }

  private getWindowMs(): number {
    return this.config.get<number>('loginProtection.windowMs') ?? 15 * 60_000;
  }

  private getBaseLockMs(): number {
    return this.config.get<number>('loginProtection.baseLockMs') ?? 60_000;
  }

  private getMaxLockMs(): number {
    return this.config.get<number>('loginProtection.maxLockMs') ?? 30 * 60_000;
  }

  private cleanupExpiredAttempts(now: number): void {
    if (now - this.lastMemoryCleanupAt < this.memoryCleanupIntervalMs) {
      return;
    }

    const windowMs = this.getWindowMs();
    for (const [key, record] of this.attempts.entries()) {
      const isExpiredWindow = now - record.lastFailureAt > windowMs;
      const lockExpired = record.lockUntil <= now;
      if (isExpiredWindow && lockExpired) {
        this.attempts.delete(key);
      }
    }

    this.lastMemoryCleanupAt = now;
  }
}
