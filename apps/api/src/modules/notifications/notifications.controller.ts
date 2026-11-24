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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@ApiTags('notifications')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.getUserNotifications(
      userId,
      query.page,
      query.limit,
      query.unread === true,
    );
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    await this.notificationsService.markAsRead(notificationId, userId);
    return { success: true };
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register device token for push notifications' })
  async registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(userId, dto.token);
  }
}
