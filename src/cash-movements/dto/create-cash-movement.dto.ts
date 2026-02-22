import { CashMovementType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCashMovementDto {
  @ApiProperty({ enum: CashMovementType, example: CashMovementType.OUT })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  @ApiProperty({
    example: '1500.50',
    description: 'Decimal string with up to two decimal places',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a decimal string with up to 2 decimal places',
  })
  amount: string;

  @ApiPropertyOptional({
    description:
      'Branch id (only for MANAGER/ADMIN without fixed branch scope).',
    example: '5bf95a57-af84-4f0b-83ab-d88a7724d89f',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: 'ARS', default: 'ARS', maxLength: 8 })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Pago de caja chica por insumos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
