import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsService } from 'src/common/metrics/metrics.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;
  let metricsService: jest.Mocked<MetricsService>;
  let getHealthMock: jest.Mock;
  let getReadinessMock: jest.Mock;
  let renderPrometheusMock: jest.Mock;

  beforeEach(() => {
    getHealthMock = jest.fn();
    getReadinessMock = jest.fn();
    renderPrometheusMock = jest.fn();
    healthService = {
      getHealth: getHealthMock,
      getReadiness: getReadinessMock,
    } as unknown as jest.Mocked<HealthService>;
    metricsService = {
      recordHttpRequest: jest.fn(),
      renderPrometheus: renderPrometheusMock,
      resetForTests: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;
    controller = new HealthController(healthService, metricsService);
  });

  it('returns liveness payload from service', () => {
    const payload = { status: 'ok', timestamp: new Date().toISOString() };
    getHealthMock.mockReturnValue(payload);

    expect(controller.getHealth()).toBe(payload);
    expect(getHealthMock).toHaveBeenCalledTimes(1);
  });

  it('returns readiness payload from service', async () => {
    const payload = {
      status: 'ready',
      checks: { database: 'up' },
      timestamp: new Date().toISOString(),
    };
    getReadinessMock.mockResolvedValue(payload);

    await expect(controller.getReadiness()).resolves.toBe(payload);
    expect(getReadinessMock).toHaveBeenCalledTimes(1);
  });

  it('returns prometheus metrics payload', () => {
    renderPrometheusMock.mockReturnValue('# HELP test metric\n');

    expect(controller.getMetrics()).toBe('# HELP test metric\n');
    expect(renderPrometheusMock).toHaveBeenCalledTimes(1);
  });
});
