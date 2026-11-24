import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListGamesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on the game name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
