import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { VotesService } from './votes.service';
import { RequestRankingService } from './ranking/request-ranking.service';
import { GamesModule } from '../games/games.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [GamesModule, NotificationsModule],
  controllers: [RequestsController],
  providers: [RequestsService, VotesService, RequestRankingService],
  exports: [RequestsService],
})
export class RequestsModule {}
