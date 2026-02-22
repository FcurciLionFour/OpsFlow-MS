import { CashMovementStatus, CashMovementType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CashMovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ enum: CashMovementType, example: CashMovementType.IN })
  type: CashMovementType;

  @ApiProperty({
    enum: CashMovementStatus,
    example: CashMovementStatus.PENDING,
  })
  status: CashMovementStatus;

  @ApiProperty({ example: '1200.50' })
  amount: string;

  @ApiProperty({ example: 'ARS' })
  currency: string;

  @ApiProperty({ nullable: true, example: 'Pago de proveedor' })
  description: string | null;

  @ApiProperty({ nullable: true })
  approvedById: string | null;

  @ApiProperty({ nullable: true })
  deliveredById: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CashMovementsListMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 6 })
  totalPages: number;
}

export class CashMovementsListResponseDto {
  @ApiProperty({ type: [CashMovementResponseDto] })
  data: CashMovementResponseDto[];

  @ApiProperty({ type: CashMovementsListMetaDto })
  meta: CashMovementsListMetaDto;
}
