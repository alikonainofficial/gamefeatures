import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@game-review/database';
import { REDIS_KEYS } from '@game-review/shared';
import Redis from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../../redis/redis.module';
import { RequestSort } from '../dto/list-requests-query.dto';
import { hotScore } from './hot-score';

export interface RankedRequest {
  id: string;
  gameId: string;
  voteCount: number;
  createdAt: Date;
}

/**
 * How long a built index is trusted before it is rebuilt from Postgres on the next access.
 * Bounds any drift (e.g. a request created while a rebuild was reading the table).
 */
export const RANKING_INDEX_TTL_SECONDS = 60 * 60;

/**
 * Owns the per-game Redis sorted sets used to page through requests (top / new / hot).
 *
 * Redis is a derived, rebuildable index; Postgres is the source of truth. A game's sets are
 * only read when its "indexed" marker exists, which is set in the same MULTI that rebuilds
 * the sets from the database. So a partial index (empty seed, Redis restart, first write)
 * is never served. If Redis fails, lists come from Postgres with the same ordering.
 */
@Injectable()
export class RequestRankingService {
  private readonly logger = new Logger(RequestRankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Rebuilds the game's sets from Postgres unless they are already complete. */
  async ensureGameIndex(gameId: string): Promise<void> {
    if (await this.redis.exists(REDIS_KEYS.gameRequestsIndexed(gameId))) return;

    const rows = await this.prisma.featureRequest.findMany({
      where: { gameId },
      select: { id: true, voteCount: true, createdAt: true },
    });

    const [top, recent, hot] = this.keys(gameId);
    const multi = this.redis.multi().del(top, recent, hot);
    if (rows.length > 0) {
      multi
        .zadd(top, ...rows.flatMap((r) => [r.voteCount, r.id]))
        .zadd(recent, ...rows.flatMap((r) => [r.createdAt.getTime(), r.id]))
        .zadd(hot, ...rows.flatMap((r) => [hotScore(r.voteCount, r.createdAt), r.id]));
    }
    multi.set(REDIS_KEYS.gameRequestsIndexed(gameId), '1', 'EX', RANKING_INDEX_TTL_SECONDS);
    await this.exec(multi);
  }

  /** Call after a request is created or its vote count changes. Never throws. */
  async upsert(request: RankedRequest): Promise<void> {
    try {
      await this.ensureGameIndex(request.gameId);
      const [top, recent, hot] = this.keys(request.gameId);
      await this.exec(
        this.redis
          .multi()
          .zadd(top, request.voteCount, request.id)
          .zadd(recent, request.createdAt.getTime(), request.id)
          .zadd(hot, hotScore(request.voteCount, request.createdAt), request.id),
      );
    } catch (error) {
      this.logger.error(`Failed to update ranking for request ${request.id}`, error as Error);
      // Make the next read rebuild from Postgres instead of trusting a stale index.
      await this.redis.del(REDIS_KEYS.gameRequestsIndexed(request.gameId)).catch(() => undefined);
    }
  }

  /** One page of request IDs in ranking order, plus the total number of requests. */
  async page(
    gameId: string,
    sort: RequestSort,
    skip: number,
    take: number,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      await this.ensureGameIndex(gameId);
      const key = this.keyFor(gameId, sort);
      const [ids, total] = (await this.exec(
        this.redis
          .multi()
          .zrevrange(key, skip, skip + take - 1)
          .zcard(key),
      )) as [string[], number];
      return { ids, total };
    } catch (error) {
      this.logger.error(`Redis ranking unavailable for game ${gameId}; using Postgres`, error as Error);
      return this.pageFromDatabase(gameId, sort, skip, take);
    }
  }

  /**
   * Same ordering as Redis. "hot" can't be computed in SQL cheaply, so it approximates with
   * votes then recency; the hot formula itself lives in hot-score.ts.
   */
  private async pageFromDatabase(gameId: string, sort: RequestSort, skip: number, take: number) {
    const orderBy: Prisma.FeatureRequestOrderByWithRelationInput[] =
      sort === 'new'
        ? [{ createdAt: 'desc' }]
        : [{ voteCount: 'desc' }, { createdAt: 'desc' }];

    const [rows, total] = await Promise.all([
      this.prisma.featureRequest.findMany({
        where: { gameId },
        select: { id: true },
        orderBy,
        skip,
        take,
      }),
      this.prisma.featureRequest.count({ where: { gameId } }),
    ]);
    return { ids: rows.map((r) => r.id), total };
  }

  /** Runs a MULTI and unwraps per-command errors, which ioredis returns rather than throws. */
  private async exec(multi: ReturnType<Redis['multi']>): Promise<unknown[]> {
    const results = await multi.exec();
    if (!results) throw new Error('Redis transaction was aborted');
    return results.map(([error, value]) => {
      if (error) throw error;
      return value;
    });
  }

  private keys(gameId: string): [string, string, string] {
    return [
      REDIS_KEYS.gameRequestsTop(gameId),
      REDIS_KEYS.gameRequestsNew(gameId),
      REDIS_KEYS.gameRequestsHot(gameId),
    ];
  }

  private keyFor(gameId: string, sort: RequestSort): string {
    const [top, recent, hot] = this.keys(gameId);
    return sort === 'top' ? top : sort === 'new' ? recent : hot;
  }
}
