import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { MetricsService } from '../metrics/metrics.service';

describe('RequestLoggingInterceptor', () => {
  it('passes through non-http context', (done) => {
    const recordHttpRequestMock = jest.fn();
    const metricsService = {
      recordHttpRequest: recordHttpRequestMock,
    } as unknown as MetricsService;
    const interceptor = new RequestLoggingInterceptor(metricsService);
    const next: CallHandler = {
      handle: () => of('ok'),
    };
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toBe('ok');
        done();
      },
      error: done,
    });
  });

  it('logs successful http requests', (done) => {
    const recordHttpRequestMock = jest.fn();
    const metricsService = {
      recordHttpRequest: recordHttpRequestMock,
    } as unknown as MetricsService;
    const interceptor = new RequestLoggingInterceptor(metricsService);
    const logger = (
      interceptor as unknown as {
        logger: { log: jest.Mock; error: jest.Mock };
      }
    ).logger;
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/health',
          url: '/health',
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
          requestId: 'req-1',
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(logger.log).toHaveBeenCalled();
        expect(recordHttpRequestMock).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            path: '/health',
            statusCode: 200,
          }),
        );
        done();
      },
      error: done,
    });
  });

  it('logs failed http requests', (done) => {
    const recordHttpRequestMock = jest.fn();
    const metricsService = {
      recordHttpRequest: recordHttpRequestMock,
    } as unknown as MetricsService;
    const interceptor = new RequestLoggingInterceptor(metricsService);
    const logger = (
      interceptor as unknown as {
        logger: { log: jest.Mock; error: jest.Mock };
      }
    ).logger;
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/auth/login',
          url: '/auth/login',
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
          requestId: 'req-2',
        }),
        getResponse: () => ({ statusCode: 401 }),
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => throwError(() => new HttpException('Unauthorized', 401)),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        done(new Error('Expected error branch'));
      },
      error: () => {
        expect(logger.error).toHaveBeenCalled();
        expect(recordHttpRequestMock).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            path: '/auth/login',
            statusCode: 401,
          }),
        );
        done();
      },
    });
  });
});
