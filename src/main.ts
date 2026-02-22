import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { shouldSetupSwagger } from './bootstrap/should-setup-swagger';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const expressApp = app.getHttpAdapter().getInstance() as {
    disable: (setting: string) => void;
    set: (setting: string, value: boolean | number | string) => void;
  };
  expressApp.disable('x-powered-by');
  expressApp.set(
    'trust proxy',
    Boolean(config.get<boolean>('http.trustProxy')),
  );
  app.enableShutdownHooks();

  app.use(helmet());
  app.use(json({ limit: config.get<string>('http.bodyLimit') || '1mb' }));
  app.use(
    urlencoded({
      extended: true,
      limit: config.get<string>('http.urlencodedLimit') || '1mb',
    }),
  );
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: config.get<string[]>('corsOrigins') ?? [],
    credentials: true,
  });

  if (shouldSetupSwagger(config)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Backend NestJS Boilerplate API')
      .setDescription('API documentation for the NestJS SaaS boilerplate')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token sent in Authorization header',
      })
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        description:
          'HttpOnly refresh token cookie used by /auth/refresh and /auth/logout',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(
      config.get<string>('swagger.path') ?? 'docs',
      app,
      document,
    );
  }

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
}

const isTestRuntime =
  process.env.NODE_ENV === 'test' ||
  process.env.JEST_WORKER_ID !== undefined ||
  process.env.npm_lifecycle_event?.startsWith('test') === true;

if (require.main === module && !isTestRuntime) {
  void bootstrap();
}
