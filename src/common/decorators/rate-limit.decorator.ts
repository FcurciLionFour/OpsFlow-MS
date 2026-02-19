import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_OPTIONS_KEY = 'rate_limit_options';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_OPTIONS_KEY, options);
