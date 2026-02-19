import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  errorCode: string;
  error_code: string;
  message: string;
  path: string;
  timestamp: string;
  requestId?: string;
  errors?: string[];
  retryAfterSeconds?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const path = req.originalUrl ?? req.url;
    const requestId = req.requestId;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let errors: string[] | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = this.mapStatusCode(statusCode);

      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const responseMessage = (response as { message?: unknown }).message;

        if (Array.isArray(responseMessage)) {
          errors = responseMessage.filter(
            (item): item is string => typeof item === 'string',
          );
          if (errors.length > 0) {
            message = errors[0];
          }
        } else if (typeof responseMessage === 'string') {
          message = responseMessage;
        }

        const responseCode = (response as { code?: unknown }).code;
        const responseErrorCode = (response as { errorCode?: unknown })
          .errorCode;
        const responseSnakeErrorCode = (response as { error_code?: unknown })
          .error_code;
        if (
          typeof responseCode === 'string' &&
          responseCode.trim().length > 0
        ) {
          code = responseCode;
        } else if (
          typeof responseErrorCode === 'string' &&
          responseErrorCode.trim().length > 0
        ) {
          code = responseErrorCode;
        } else if (
          typeof responseSnakeErrorCode === 'string' &&
          responseSnakeErrorCode.trim().length > 0
        ) {
          code = responseSnakeErrorCode;
        }

        const responseRetryAfterSeconds = (
          response as {
            retryAfterSeconds?: unknown;
          }
        ).retryAfterSeconds;
        if (
          typeof responseRetryAfterSeconds === 'number' &&
          Number.isFinite(responseRetryAfterSeconds) &&
          responseRetryAfterSeconds > 0
        ) {
          retryAfterSeconds = Math.ceil(responseRetryAfterSeconds);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const body: ErrorBody = {
      statusCode,
      code,
      errorCode: code,
      error_code: code,
      message,
      path,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (errors && errors.length > 0) {
      body.errors = errors;
    }

    if (retryAfterSeconds !== undefined) {
      body.retryAfterSeconds = retryAfterSeconds;
      res.setHeader('Retry-After', retryAfterSeconds.toString());
    }

    res.status(statusCode).json(body);
  }

  private mapStatusCode(statusCode: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'TOO_MANY_REQUESTS',
      503: 'SERVICE_UNAVAILABLE',
    };

    return map[statusCode] ?? 'HTTP_ERROR';
  }
}
