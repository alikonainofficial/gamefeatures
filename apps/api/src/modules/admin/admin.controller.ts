import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { GrantDevAccessDto } from './dto/grant-dev-access.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('games/:gameId/grant-access')
  @ApiOperation({ summary: 'Grant dev access to a user for a game' })
  async grantDevAccess(
    @Param('gameId') gameId: string,
    @Body() dto: GrantDevAccessDto,
  ) {
    return this.adminService.grantDevAccess(gameId, dto.userId);
  }

  @Delete('games/:gameId/revoke-access')
  @ApiOperation({ summary: 'Revoke dev access from a game' })
  async revokeDevAccess(@Param('gameId') gameId: string) {
    return this.adminService.revokeDevAccess(gameId);
  }

  @Get('games/with-dev-access')
  @ApiOperation({ summary: 'List games with dev access granted' })
  async listGamesWithDevAccess(@Query() pagination: PaginationDto) {
    return this.adminService.listGamesWithDevAccess(pagination.page, pagination.limit);
  }

  @Post('users/:userId/make-admin')
  @ApiOperation({ summary: 'Make a user an admin' })
  async makeUserAdmin(@Param('userId') userId: string) {
    return this.adminService.makeUserAdmin(userId);
  }
}
