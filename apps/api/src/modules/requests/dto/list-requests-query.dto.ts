import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const REQUEST_SORTS = ['hot', 'top', 'new'] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];

export class ListRequestsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REQUEST_SORTS, default: 'hot' })
  @IsOptional()
  @IsIn(REQUEST_SORTS)
  sort: RequestSort = 'hot';
}
