import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: '2026-02-15T20:30:00.000Z' })
  timestamp: string;
}

class ReadinessChecksDto {
  @ApiProperty({ example: 'up' })
  database: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ready' })
  status: string;

  @ApiProperty({ type: ReadinessChecksDto })
  checks: ReadinessChecksDto;

  @ApiProperty({ example: '2026-02-15T20:30:00.000Z' })
  timestamp: string;
}
