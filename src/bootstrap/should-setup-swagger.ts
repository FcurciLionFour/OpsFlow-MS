import { ConfigService } from '@nestjs/config';

export function shouldSetupSwagger(config: ConfigService): boolean {
  const swaggerEnabled = config.get<boolean>('swagger.enabled') === true;
  const isProduction = config.get<string>('nodeEnv') === 'production';
  const allowInProduction =
    config.get<boolean>('swagger.allowInProduction') === true;

  return swaggerEnabled && (!isProduction || allowInProduction);
}
