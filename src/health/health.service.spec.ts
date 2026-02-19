import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('HealthService', () => {
  it('returns ok health payload', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRawUnsafe: jest.fn() },
        },
      ],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns ready when database is reachable', async () => {
    const query = jest.fn().mockResolvedValue([1]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRawUnsafe: query },
        },
      ],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = await service.getReadiness();

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(result).toMatchObject({
      status: 'ready',
      checks: { database: 'up' },
    });
  });

  it('throws 503 when database is unreachable', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockRejectedValue(new Error()),
          },
        },
      ],
    }).compile();

    const service = moduleRef.get(HealthService);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
