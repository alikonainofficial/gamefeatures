import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { VotesService } from './votes.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
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
  async findByGame(
    @Param('slug') slug: string,
    @Query() query: ListRequestsQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.requestsService.findByGame(slug, query.sort, query.page, query.limit, userId);
  }

  @Put('requests/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upvote a feature request (idempotent)' })
  async addVote(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.votesService.addVote(id, userId);
  }

  @Delete('requests/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove your upvote from a feature request (idempotent)' })
  async removeVote(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.votesService.removeVote(id, userId);
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
