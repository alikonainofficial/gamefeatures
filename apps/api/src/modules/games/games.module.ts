import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { RawgAdapter } from './game-api/rawg.adapter';

@Module({
  imports: [HttpModule],
  controllers: [GamesController],
  providers: [GamesService, RawgAdapter],
  exports: [GamesService],
})
export class GamesModule {}
