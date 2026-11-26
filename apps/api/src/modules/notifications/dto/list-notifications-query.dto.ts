import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ type: Boolean, description: 'true = only unread notifications' })
  @IsOptional()
  // Read the raw query value: implicit conversion would turn 'false' into Boolean('false') === true.
  // Anything other than true/false stays a string so @IsBoolean rejects it with a 400.
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  unread?: boolean;
}
