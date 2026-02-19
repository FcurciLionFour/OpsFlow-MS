import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginAttemptService } from './login-attempt.service';

describe('LoginAttemptService', () => {
  const configMock = {
    get: jest.fn(),
  } as unknown as ConfigService;

  let service: LoginAttemptService;

  beforeEach(() => {
    jest.clearAllMocks();
    (configMock.get as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        'loginProtection.enabled': true,
        'loginProtection.maxFailures': 3,
        'loginProtection.windowMs': 60000,
        'loginProtection.baseLockMs': 1000,
        'loginProtection.maxLockMs': 10000,
      };
      return values[key];
    });
    service = new LoginAttemptService(configMock);
  });

  it('locks a key after configured failures', async () => {
    await service.recordFailure('user@test.com', '127.0.0.1');
    await service.recordFailure('user@test.com', '127.0.0.1');
    await service.recordFailure('user@test.com', '127.0.0.1');

    await expect(
      service.assertNotLocked('user@test.com', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('resets attempts on success', async () => {
    await service.recordFailure('user@test.com', '127.0.0.1');
    await service.recordFailure('user@test.com', '127.0.0.1');

    await service.recordSuccess('user@test.com', '127.0.0.1');

    await expect(
      service.assertNotLocked('user@test.com', '127.0.0.1'),
    ).resolves.toBeUndefined();
  });

  it('separates lock keys by ip and email', async () => {
    await service.recordFailure('user@test.com', '10.0.0.1');
    await service.recordFailure('user@test.com', '10.0.0.1');
    await service.recordFailure('user@test.com', '10.0.0.1');

    await expect(
      service.assertNotLocked('user@test.com', '10.0.0.2'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertNotLocked('other@test.com', '10.0.0.1'),
    ).resolves.toBeUndefined();
  });
});
