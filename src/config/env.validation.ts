// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:4200'),
  CORS_ORIGINS: Joi.string().allow('').optional(),

  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_CSRF_MAX_AGE_MS: Joi.number().integer().min(60000).default(7200000),
  COOKIE_REFRESH_MAX_AGE_MS: Joi.number()
    .integer()
    .min(300000)
    .default(604800000),
  TRUST_PROXY: Joi.boolean().default(false),
  HTTP_BODY_LIMIT: Joi.string().default('1mb'),
  HTTP_URLENCODED_LIMIT: Joi.string().default('1mb'),
  RATE_LIMIT_REDIS_URL: Joi.string().uri().optional(),
  LOGIN_LOCK_ENABLED: Joi.boolean().default(true),
  LOGIN_LOCK_REDIS_URL: Joi.string().uri().optional(),
  LOGIN_MAX_FAILURES: Joi.number().integer().min(1).default(5),
  LOGIN_ATTEMPT_WINDOW_MS: Joi.number().integer().min(60000).default(900000),
  LOGIN_LOCK_BASE_MS: Joi.number().integer().min(1000).default(60000),
  LOGIN_LOCK_MAX_MS: Joi.number().integer().min(1000).default(1800000),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  SWAGGER_ALLOW_IN_PRODUCTION: Joi.boolean().default(false),
  SWAGGER_PATH: Joi.string().default('docs'),

  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
});
