import { ApiProperty } from '@nestjs/swagger';

export class AccessTokenResponseDto {
  @ApiProperty()
  accessToken: string;
}

export class OkResponseDto {
  @ApiProperty()
  ok: boolean;
}
