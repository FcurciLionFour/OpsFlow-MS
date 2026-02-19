import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses CORS origins and exposes redis URLs for protections', () => {
    process.env.CORS_ORIGINS = 'https://a.example.com, https://b.example.com';
    process.env.RATE_LIMIT_REDIS_URL = 'redis://localhost:6379';
    process.env.LOGIN_LOCK_REDIS_URL = 'redis://localhost:6380';

    const config = configuration();

    expect(config.corsOrigins).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
    expect(config.rateLimit.redisUrl).toBe('redis://localhost:6379');
    expect(config.loginProtection.redisUrl).toBe('redis://localhost:6380');
  });

  it('keeps swagger disabled by default and blocks prod override by default', () => {
    delete process.env.SWAGGER_ENABLED;
    delete process.env.SWAGGER_ALLOW_IN_PRODUCTION;
    process.env.NODE_ENV = 'production';

    const config = configuration();

    expect(config.swagger.enabled).toBe(false);
    expect(config.swagger.allowInProduction).toBe(false);
  });

  it('enables swagger and production override only with explicit true flags', () => {
    process.env.SWAGGER_ENABLED = 'true';
    process.env.SWAGGER_ALLOW_IN_PRODUCTION = 'true';
    process.env.NODE_ENV = 'production';

    const config = configuration();

    expect(config.swagger.enabled).toBe(true);
    expect(config.swagger.allowInProduction).toBe(true);
  });
});
