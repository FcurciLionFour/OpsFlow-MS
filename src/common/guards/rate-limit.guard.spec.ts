import { type ExecutionContext, type HttpArgumentsHost } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RateLimitGuard } from './rate-limit.guard';

function buildContext(req: Partial<Request>, res: Partial<Response>) {
  class DummyClass {}
  function dummyHandler() {}

  const httpHost: HttpArgumentsHost = {
    getRequest: () => req as Request,
    getResponse: () => res as Response,
    getNext: () => undefined as never,
  };

  return {
    getHandler: () => dummyHandler,
    getClass: () => DummyClass,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    switchToHttp: () => httpHost,
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    RateLimitGuard.resetForTests();
  });

  it('allows request when no rate limit metadata is present', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const guard = new RateLimitGuard(reflectorMock);

    const req = {
      method: 'POST',
      ip: '127.0.0.1',
      url: '/auth/login',
    } as Partial<Request>;
    const setHeader = jest.fn();
    const res = { setHeader } as Partial<Response>;
    const context = buildContext(req, res);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('sets rate limit headers for first request in a window', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue({
      limit: 2,
      windowMs: 60000,
    });
    const guard = new RateLimitGuard(reflectorMock);

    const req = {
      method: 'POST',
      ip: '127.0.0.1',
      url: '/auth/login',
      originalUrl: '/auth/login',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const context = buildContext(req, res);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '2');
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
  });

  it('throws 429 when request count exceeds limit', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue({
      limit: 1,
      windowMs: 60000,
    });
    const guard = new RateLimitGuard(reflectorMock);

    const req = {
      method: 'POST',
      ip: '127.0.0.1',
      url: '/auth/login',
      originalUrl: '/auth/login',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const context = buildContext(req, res);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });

    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});
