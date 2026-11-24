import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { RequestType } from '@game-review/database';

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  gameId: string;

  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  description: string;
}
