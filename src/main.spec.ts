import { ConfigService } from '@nestjs/config';
import { shouldSetupSwagger } from './main';

describe('shouldSetupSwagger', () => {
  const buildConfig = (values: Record<string, unknown>) =>
    ({
      get: (key: string) => values[key],
    }) as unknown as ConfigService;

  it('returns false when swagger is disabled', () => {
    const config = buildConfig({
      'swagger.enabled': false,
      nodeEnv: 'development',
      'swagger.allowInProduction': false,
    });

    expect(shouldSetupSwagger(config)).toBe(false);
  });

  it('returns true in development when enabled', () => {
    const config = buildConfig({
      'swagger.enabled': true,
      nodeEnv: 'development',
      'swagger.allowInProduction': false,
    });

    expect(shouldSetupSwagger(config)).toBe(true);
  });

  it('returns false in production without explicit override', () => {
    const config = buildConfig({
      'swagger.enabled': true,
      nodeEnv: 'production',
      'swagger.allowInProduction': false,
    });

    expect(shouldSetupSwagger(config)).toBe(false);
  });

  it('returns true in production only with explicit override', () => {
    const config = buildConfig({
      'swagger.enabled': true,
      nodeEnv: 'production',
      'swagger.allowInProduction': true,
    });

    expect(shouldSetupSwagger(config)).toBe(true);
  });
});
