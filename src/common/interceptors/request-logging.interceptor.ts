import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);
  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const requestId = req.requestId;
    const method = req.method;
    const path = req.originalUrl ?? req.url;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.metricsService?.recordHttpRequest({
            method,
            path,
            statusCode: res.statusCode,
            durationMs,
          });

          this.logger.log(
            JSON.stringify({
              event: 'http_request',
              level: 'info',
              requestId,
              method,
              path,
              statusCode: res.statusCode,
              durationMs,
              ip,
              userAgent,
            }),
          );
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          const durationMs = Date.now() - startedAt;
          this.metricsService?.recordHttpRequest({
            method,
            path,
            statusCode,
            durationMs,
          });

          this.logger.error(
            JSON.stringify({
              event: 'http_request',
              level: 'error',
              requestId,
              method,
              path,
              statusCode,
              durationMs,
              ip,
              userAgent,
              error:
                error instanceof Error ? error.message : 'Unhandled exception',
            }),
          );
        },
      }),
    );
  }
}
