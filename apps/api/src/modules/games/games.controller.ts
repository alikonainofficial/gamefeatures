import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { Throttle } from '@nestjs/throttler';
import { IMPORT_THROTTLE } from '../../common/throttle';
import { SearchGamesDto } from './dto/search-games.dto';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List games (from local database)' })
  async findAll(@Query() query: ListGamesQueryDto) {
    return this.gamesService.findAll(query.page, query.limit, query.search);
  }

  @Get('search/rawg')
  @ApiOperation({ summary: 'Search games from RAWG API' })
  async searchRawg(@Query() dto: SearchGamesDto) {
    return this.gamesService.searchRawg(dto.query, dto.page, dto.limit);
  }

  @Post('import/:externalId')
  @Throttle(IMPORT_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import a game from RAWG' })
  async importGame(@Param('externalId') externalId: string) {
    return this.gamesService.importFromRawg(externalId);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get game details by slug' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.gamesService.findBySlug(slug, userId);
  }
}
