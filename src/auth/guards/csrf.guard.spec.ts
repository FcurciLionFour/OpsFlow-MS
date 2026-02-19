import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function buildContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows non-mutating methods without csrf headers', () => {
    const req = { method: 'GET', headers: {}, cookies: {} };
    expect(guard.canActivate(buildContext(req))).toBe(true);
  });

  it('blocks mutating methods with missing tokens', () => {
    const req = { method: 'POST', headers: {}, cookies: {} };
    expect(() => guard.canActivate(buildContext(req))).toThrow(
      ForbiddenException,
    );
  });

  it('allows mutating methods when cookie and header match', () => {
    const req = {
      method: 'PATCH',
      originalUrl: '/auth/refresh',
      headers: { 'x-csrf-token': 'abc' },
      cookies: { csrf_token: 'abc' },
    };

    expect(guard.canActivate(buildContext(req))).toBe(true);
  });
});
