import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records request counters and durations in prometheus format', () => {
    service.recordHttpRequest({
      method: 'GET',
      path: '/health?full=true',
      statusCode: 200,
      durationMs: 12.5,
    });
    service.recordHttpRequest({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: 7.5,
    });

    const payload = service.renderPrometheus();

    expect(payload).toContain('http_requests_total');
    expect(payload).toContain(
      'http_requests_total{method="GET",path="/health",status_code="200"} 2',
    );
    expect(payload).toContain(
      'http_request_duration_ms_count{method="GET",path="/health",status_code="200"} 2',
    );
    expect(payload).toContain(
      'http_request_duration_ms_sum{method="GET",path="/health",status_code="200"} 20.000',
    );
  });

  it('escapes labels and resets metrics for tests', () => {
    service.recordHttpRequest({
      method: 'POST',
      path: '/users/"quoted"\\x',
      statusCode: 401,
      durationMs: 1,
    });

    const withData = service.renderPrometheus();
    expect(withData).toContain('/users/\\"quoted\\"\\\\x');

    service.resetForTests();
    const resetPayload = service.renderPrometheus();
    expect(resetPayload).not.toContain('http_requests_total{');
  });
});
