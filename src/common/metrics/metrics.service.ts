import { Injectable } from '@nestjs/common';

interface HttpMetricValue {
  count: number;
  durationSumMs: number;
}

interface RecordHttpRequestInput {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly httpRequestTotals = new Map<string, number>();
  private readonly httpRequestDurations = new Map<string, HttpMetricValue>();
  private readonly startedAt = Date.now();

  recordHttpRequest(input: RecordHttpRequestInput): void {
    const method = this.escapeLabel(input.method.toUpperCase());
    const path = this.escapeLabel(this.normalizePath(input.path));
    const statusCode = String(input.statusCode);
    const durationMs = Math.max(0, input.durationMs);
    const labels = `method="${method}",path="${path}",status_code="${statusCode}"`;

    const currentCount = this.httpRequestTotals.get(labels) ?? 0;
    this.httpRequestTotals.set(labels, currentCount + 1);

    const currentDuration = this.httpRequestDurations.get(labels) ?? {
      count: 0,
      durationSumMs: 0,
    };
    this.httpRequestDurations.set(labels, {
      count: currentDuration.count + 1,
      durationSumMs: currentDuration.durationSumMs + durationMs,
    });
  }

  renderPrometheus(): string {
    const lines: string[] = [
      '# HELP app_uptime_seconds Process uptime in seconds',
      '# TYPE app_uptime_seconds gauge',
      `app_uptime_seconds ${((Date.now() - this.startedAt) / 1000).toFixed(3)}`,
      '# HELP http_requests_total Total number of HTTP requests',
      '# TYPE http_requests_total counter',
    ];

    for (const [labels, total] of this.httpRequestTotals.entries()) {
      lines.push(`http_requests_total{${labels}} ${total}`);
    }

    lines.push(
      '# HELP http_request_duration_ms_sum Sum of HTTP request durations in milliseconds',
      '# TYPE http_request_duration_ms_sum counter',
    );
    for (const [labels, duration] of this.httpRequestDurations.entries()) {
      lines.push(
        `http_request_duration_ms_sum{${labels}} ${duration.durationSumMs.toFixed(3)}`,
      );
    }

    lines.push(
      '# HELP http_request_duration_ms_count Count of HTTP request durations',
      '# TYPE http_request_duration_ms_count counter',
    );
    for (const [labels, duration] of this.httpRequestDurations.entries()) {
      lines.push(`http_request_duration_ms_count{${labels}} ${duration.count}`);
    }

    return `${lines.join('\n')}\n`;
  }

  resetForTests(): void {
    this.httpRequestTotals.clear();
    this.httpRequestDurations.clear();
  }

  private normalizePath(path: string): string {
    const [basePath] = path.split('?');
    return basePath || '/';
  }

  private escapeLabel(input: string): string {
    return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
