import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GrantDevAccessDto {
  @ApiProperty()
  @IsString()
  userId: string;
}
