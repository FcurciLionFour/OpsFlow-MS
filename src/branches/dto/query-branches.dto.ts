import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class QueryBranchesDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
