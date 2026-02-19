import { Controller, Get, Header } from '@nestjs/common';
import { Public } from 'src/auth/decorators/public.decorator';
import { HealthService } from './health.service';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import {
  HealthResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';
import { MetricsService } from 'src/common/metrics/metrics.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness endpoint' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness endpoint with dependency checks' })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  getReadiness() {
    return this.healthService.getReadiness();
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiExcludeEndpoint()
  getMetrics() {
    return this.metricsService.renderPrometheus();
  }
}
