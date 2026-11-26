import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('requests/:requestId/comments')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get comments for a feature request' })
  async findByRequest(
    @Param('requestId') requestId: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.commentsService.findByRequest(requestId, userId);
  }

  @Post('requests/:requestId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a feature request' })
  async create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.create(requestId, dto, userId);
  }

  @Put('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a comment (idempotent)' })
  async addLike(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.commentsService.addLike(id, userId);
  }

  @Delete('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove your like from a comment (idempotent)' })
  async removeLike(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.commentsService.removeLike(id, userId);
  }
}
