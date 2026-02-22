import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class CashflowStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Optional branch filter within accessible branch scope',
    example: '5bf95a57-af84-4f0b-83ab-d88a7724d89f',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: '2026-02-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-02-19T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
