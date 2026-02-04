import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { VotesService } from './votes.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserType } from '@game-review/database';

@ApiTags('requests')
@Controller()
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly votesService: VotesService,
  ) {}

  @Post('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a feature request' })
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.requestsService.create(dto, userId);
  }

  @Get('requests/:id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a feature request by ID' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.requestsService.findById(id, userId);
  }

  @Get('games/:slug/requests')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get feature requests for a game' })
  @ApiQuery({ name: 'sort', enum: ['hot', 'top', 'new'], required: false })
  async findByGame(
    @Param('slug') slug: string,
    @Query('sort') sort: 'hot' | 'top' | 'new' = 'hot',
    @Query() pagination: PaginationDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.requestsService.findByGame(slug, sort, pagination.page, pagination.limit, userId);
  }

  @Post('requests/:id/upvote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle upvote on a feature request' })
  async toggleVote(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.votesService.toggleVote(id, userId);
  }

  @Patch('requests/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update feature request status (dev team only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: { id: string; userType: UserType; isAdmin: boolean },
  ) {
    return this.requestsService.updateStatus(
      id,
      dto,
      user.id,
      user.userType,
      user.isAdmin,
    );
  }
}
