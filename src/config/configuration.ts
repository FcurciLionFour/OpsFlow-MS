// src/config/configuration.ts
export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL,
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cookies: {
    sameSite: process.env.COOKIE_SAME_SITE,
    secure:
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production',
    csrfMaxAgeMs: parseInt(process.env.COOKIE_CSRF_MAX_AGE_MS ?? '7200000', 10),
    refreshMaxAgeMs: parseInt(
      process.env.COOKIE_REFRESH_MAX_AGE_MS ?? '604800000',
      10,
    ),
  },
  http: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    bodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
    urlencodedLimit: process.env.HTTP_URLENCODED_LIMIT ?? '1mb',
  },
  rateLimit: {
    redisUrl: process.env.RATE_LIMIT_REDIS_URL,
  },
  loginProtection: {
    enabled: process.env.LOGIN_LOCK_ENABLED !== 'false',
    redisUrl: process.env.LOGIN_LOCK_REDIS_URL,
    maxFailures: parseInt(process.env.LOGIN_MAX_FAILURES ?? '5', 10),
    windowMs: parseInt(process.env.LOGIN_ATTEMPT_WINDOW_MS ?? '900000', 10),
    baseLockMs: parseInt(process.env.LOGIN_LOCK_BASE_MS ?? '60000', 10),
    maxLockMs: parseInt(process.env.LOGIN_LOCK_MAX_MS ?? '1800000', 10),
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
    allowInProduction: process.env.SWAGGER_ALLOW_IN_PRODUCTION === 'true',
    path: process.env.SWAGGER_PATH ?? 'docs',
  },
});
