import {
  Controller,
  Put,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Put('users/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user (idempotent)' })
  async followUser(@Param('userId') userId: string, @CurrentUser('id') currentUserId: string) {
    return this.followsService.followUser(currentUserId, userId);
  }

  @Delete('users/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user (idempotent)' })
  async unfollowUser(@Param('userId') userId: string, @CurrentUser('id') currentUserId: string) {
    return this.followsService.unfollowUser(currentUserId, userId);
  }

  @Put('games/:gameId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a game (idempotent)' })
  async followGame(@Param('gameId') gameId: string, @CurrentUser('id') currentUserId: string) {
    return this.followsService.followGame(currentUserId, gameId);
  }

  @Delete('games/:gameId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a game (idempotent)' })
  async unfollowGame(@Param('gameId') gameId: string, @CurrentUser('id') currentUserId: string) {
    return this.followsService.unfollowGame(currentUserId, gameId);
  }

  @Get('users/:userId/followers')
  @ApiOperation({ summary: 'Get followers of a user' })
  async getUserFollowers(
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.followsService.getUserFollowers(userId, pagination.page, pagination.limit);
  }

  @Get('users/:userId/following')
  @ApiOperation({ summary: 'Get users that a user is following' })
  async getUserFollowing(
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.followsService.getUserFollowing(userId, pagination.page, pagination.limit);
  }

  @Get('me/games')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get games that current user follows' })
  async getMyFollowedGames(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.followsService.getUserFollowedGames(userId, pagination.page, pagination.limit);
  }
}
