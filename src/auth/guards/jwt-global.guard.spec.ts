import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { JwtGlobalGuard } from './jwt-global.guard';

describe('JwtGlobalGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true when route is public', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;

    const guard = new JwtGlobalGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('normalizes observable result from base guard', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    const guard = new JwtGlobalGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const baseProto = Object.getPrototypeOf(JwtGlobalGuard.prototype) as {
      canActivate: (ctx: ExecutionContext) => unknown;
    };

    jest.spyOn(baseProto, 'canActivate').mockReturnValueOnce(of(true));

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
