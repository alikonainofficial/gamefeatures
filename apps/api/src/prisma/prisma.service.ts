import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@game-review/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Outside development, errors are not logged here: expected ones (e.g. a duplicate vote,
      // P2002) are handled, and unexpected ones reach Nest's logger through the exception filter.
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
