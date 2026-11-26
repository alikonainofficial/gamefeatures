import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

export type DependencyState = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  db: DependencyState;
  redis: DependencyState;
  /** Seconds since the process started (a fresh number after every cold start). */
  uptime: number;
}

/**
 * A dependency that hangs (e.g. Redis unreachable: ioredis queues commands while it
 * reconnects) must not hang the health check, so each check gets its own deadline.
 */
const CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const [db, redis] = await Promise.all([
      this.probe('db', () => this.prisma.$queryRaw`SELECT 1`),
      this.probe('redis', () => this.redis.ping()),
    ]);

    return {
      status: db === 'up' && redis === 'up' ? 'ok' : 'error',
      db,
      redis,
      uptime: Math.round(process.uptime()),
    };
  }

  private async probe(name: string, run: () => Promise<unknown>): Promise<DependencyState> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS} ms`)), CHECK_TIMEOUT_MS);
    });

    try {
      await Promise.race([run(), timeout]);
      return 'up';
    } catch (error) {
      // Logged for the operator; the HTTP response only says "down" (no connection details).
      this.logger.warn(`Health check: ${name} is down (${(error as Error).message})`);
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
