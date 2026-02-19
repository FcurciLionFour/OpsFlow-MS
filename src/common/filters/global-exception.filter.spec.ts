import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHost({ requestId, path }: { requestId?: string; path: string }) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  const request = {
    requestId,
    url: path,
    originalUrl: path,
  };

  return {
    response,
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    },
  };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('maps unauthorized exception to standard payload', () => {
    const { host, response } = createHost({
      requestId: 'req-1',
      path: '/secure',
    });

    filter.catch(
      new UnauthorizedException('Invalid token'),
      host as unknown as ArgumentsHost,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        errorCode: 'UNAUTHORIZED',
        error_code: 'UNAUTHORIZED',
        message: 'Invalid token',
        path: '/secure',
        requestId: 'req-1',
      }),
    );
  });

  it('includes validation errors array on bad request', () => {
    const { host, response } = createHost({
      requestId: 'req-2',
      path: '/auth/register',
    });

    filter.catch(
      new BadRequestException(['email must be an email', 'password too short']),
      host as unknown as ArgumentsHost,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'BAD_REQUEST',
        errorCode: 'BAD_REQUEST',
        error_code: 'BAD_REQUEST',
        message: 'email must be an email',
        errors: ['email must be an email', 'password too short'],
      }),
    );
  });

  it('maps forbidden exception to FORBIDDEN', () => {
    const { host, response } = createHost({
      requestId: undefined,
      path: '/rbac/users-read',
    });

    filter.catch(
      new ForbiddenException('Not enough permissions'),
      host as unknown as ArgumentsHost,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'FORBIDDEN',
        errorCode: 'FORBIDDEN',
        error_code: 'FORBIDDEN',
        message: 'Not enough permissions',
      }),
    );
  });

  it('maps retry-after metadata on too many requests', () => {
    const { host, response } = createHost({
      requestId: 'req-3',
      path: '/auth/login',
    });

    filter.catch(
      new HttpException(
        {
          code: 'LOGIN_LOCKED',
          message: 'Too many failed login attempts',
          retryAfterSeconds: 42,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      host as unknown as ArgumentsHost,
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LOGIN_LOCKED',
        errorCode: 'LOGIN_LOCKED',
        error_code: 'LOGIN_LOCKED',
        retryAfterSeconds: 42,
      }),
    );
  });
});
