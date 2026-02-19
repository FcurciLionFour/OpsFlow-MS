import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'UNAUTHORIZED' })
  code: string;

  @ApiProperty({ example: 'UNAUTHORIZED' })
  errorCode: string;

  @ApiProperty({ example: 'UNAUTHORIZED' })
  error_code: string;

  @ApiProperty({ example: 'Invalid token' })
  message: string;

  @ApiProperty({ example: '/users' })
  path: string;

  @ApiProperty({ example: '2026-02-15T20:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '9e399153-2df5-4f70-9d00-4f7875b746f5' })
  requestId?: string;

  @ApiProperty({ example: 60, required: false })
  retryAfterSeconds?: number;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    example: ['email must be an email', 'password must be longer than 6'],
    required: false,
    type: [String],
  })
  errors?: string[];
}
