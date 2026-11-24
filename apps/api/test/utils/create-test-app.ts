import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { RawgAdapter } from '../../src/modules/games/game-api/rawg.adapter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import { FakeRawgAdapter } from './fake-rawg.adapter';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  rawg: FakeRawgAdapter;
  /** A fresh supertest client against the in-process server. Paths include `/api/v1`. */
  http: () => ReturnType<typeof request>;
}

/**
 * Boots the real AppModule (real Postgres, Redis and BullMQ) with the production HTTP
 * pipeline from configureApp(). Only the external RAWG API is replaced.
 */
export async function createTestApp(): Promise<TestApp> {
  const rawg = new FakeRawgAdapter();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RawgAdapter)
    .useValue(rawg)
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  // Listen on a random port: supertest reuses it (instead of opening a listener per request,
  // which flakes under parallel requests), and socket.io clients can connect to it.
  await app.listen(0, '127.0.0.1');

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get<Redis>(REDIS_CLIENT),
    rawg,
    http: () => request(app.getHttpServer()),
  };
}
