// App start-up (Prisma, Redis, BullMQ) can take a few seconds on a cold CI runner.
jest.setTimeout(30_000);
