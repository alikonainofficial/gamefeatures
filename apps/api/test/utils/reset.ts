import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@game-review/shared';
import { Queue } from 'bullmq';
import { assertTestDatabase } from './load-test-env';
import { TestApp } from './create-test-app';

/** Empties every table, the test Redis DB and the BullMQ queues. Call in beforeEach. */
export async function resetState({ app, prisma, redis, rawg }: TestApp): Promise<void> {
  assertTestDatabase();

  const queue = app.get<Queue>(getQueueToken(QUEUE_NAMES.notifications));
  await queue.drain(true);

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  await redis.flushdb();
  rawg.clear();
}
