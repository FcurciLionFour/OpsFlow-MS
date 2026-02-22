import { ApiProperty } from '@nestjs/swagger';

class CashflowRangeDto {
  @ApiProperty({ example: '2026-02-01T00:00:00.000Z', nullable: true })
  from: string | null;

  @ApiProperty({ example: '2026-02-19T23:59:59.999Z', nullable: true })
  to: string | null;
}

class CashflowCardsDto {
  @ApiProperty({ example: '12345.00' })
  totalIn: string;

  @ApiProperty({ example: '6789.00' })
  totalOut: string;

  @ApiProperty({ example: '5556.00' })
  net: string;

  @ApiProperty({ example: 3 })
  pendingCount: number;

  @ApiProperty({ example: 2 })
  approvedCount: number;

  @ApiProperty({ example: 5 })
  deliveredCount: number;

  @ApiProperty({ example: 1 })
  rejectedCount: number;
}

export class CashflowStatsResponseDto {
  @ApiProperty({ type: CashflowRangeDto })
  range: CashflowRangeDto;

  @ApiProperty({ nullable: true, example: null })
  branchId: string | null;

  @ApiProperty({ type: CashflowCardsDto })
  cards: CashflowCardsDto;
}
