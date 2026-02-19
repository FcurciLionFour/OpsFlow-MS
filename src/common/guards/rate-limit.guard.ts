import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  RATE_LIMIT_OPTIONS_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '../errors/error-codes';

interface CounterEntry {
  count: number;
  resetAt: number;
}

interface RateLimitIncrementResult {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard
  implements CanActivate, OnModuleInit, OnModuleDestroy
{
  private static readonly counters = new Map<string, CounterEntry>();
  private static lastMemoryCleanupAt = 0;
  private static readonly memoryCleanupIntervalMs = 60_000;
  private readonly logger = new Logger(RateLimitGuard.name);
  private redisClient: null | {
    eval: (script: string, options: unknown) => Promise<[number, number]>;
    connect: () => Promise<void>;
    quit: () => Promise<void>;
  } = null;
  private redisEnabled = false;

  static resetForTests(): void {
    RateLimitGuard.counters.clear();
    RateLimitGuard.lastMemoryCleanupAt = 0;
  }

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl =
      this.configService?.get<string>('rateLimit.redisUrl') ??
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
          eval: (
            script: string,
            options: {
              keys: string[];
              arguments: string[];
            },
          ) => Promise<[number, number]>;
        };
      };

      const client = redis.createClient({ url: redisUrl });
      await client.connect();
      this.redisClient = client;
      this.redisEnabled = true;
      this.logger.log('Rate limit store initialized with Redis');
    } catch (error) {
      this.redisClient = null;
      this.redisEnabled = false;
      const reason =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(
        `Redis rate limit disabled; using in-memory fallback. Reason: ${reason}`,
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_OPTIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? null;

    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const now = Date.now();

    const route = this.normalizeRoute(
      req.originalUrl ?? req.url ?? context.getHandler().name,
    );
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.method}:${route}`;
    const incrementResult = await this.incrementCounter(key, options.windowMs);
    const remaining = Math.max(0, options.limit - incrementResult.count);

    if (incrementResult.count > options.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((incrementResult.resetAt - now) / 1000),
      );
      this.setHeaders(res, options, remaining, incrementResult.resetAt - now);
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.setHeaders(res, options, remaining, incrementResult.resetAt - now);
    return true;
  }

  private async incrementCounter(
    key: string,
    windowMs: number,
  ): Promise<RateLimitIncrementResult> {
    if (this.redisEnabled && this.redisClient) {
      try {
        const script = [
          'local c = redis.call("INCR", KEYS[1])',
          'if c == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end',
          'local ttl = redis.call("PTTL", KEYS[1])',
          'return {c, ttl}',
        ].join('\n');

        const [count, ttl] = await this.redisClient.eval(script, {
          keys: [`rl:${key}`],
          arguments: [windowMs.toString()],
        });

        const ttlMs = ttl > 0 ? ttl : windowMs;
        return {
          count,
          resetAt: Date.now() + ttlMs,
        };
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Unknown Redis error';
        this.logger.error(
          `Redis rate limit failed; switching to in-memory fallback. Reason: ${reason}`,
        );
        this.redisEnabled = false;
      }
    }

    const now = Date.now();
    this.cleanupExpiredCounters(now);
    const existing = RateLimitGuard.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      const entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      RateLimitGuard.counters.set(key, entry);
      return entry;
    }

    existing.count += 1;
    return existing;
  }

  private normalizeRoute(route: string): string {
    const [baseRoute] = route.split('?');
    return baseRoute || '/';
  }

  private cleanupExpiredCounters(now: number): void {
    if (
      now - RateLimitGuard.lastMemoryCleanupAt <
      RateLimitGuard.memoryCleanupIntervalMs
    ) {
      return;
    }

    for (const [counterKey, counter] of RateLimitGuard.counters.entries()) {
      if (counter.resetAt <= now) {
        RateLimitGuard.counters.delete(counterKey);
      }
    }

    RateLimitGuard.lastMemoryCleanupAt = now;
  }

  private setHeaders(
    res: Response,
    options: RateLimitOptions,
    remaining: number,
    resetInMs: number,
  ) {
    res.setHeader('X-RateLimit-Limit', options.limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(Date.now() / 1000 + resetInMs / 1000).toString(),
    );
  }
}
