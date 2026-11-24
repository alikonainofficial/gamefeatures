import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RawgAdapter, RawgGame } from './game-api/rawg.adapter';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rawgAdapter: RawgAdapter,
  ) {}

  async searchRawg(query: string, page = 1, limit = 20) {
    const result = await this.rawgAdapter.searchGames(query, page, limit);

    return {
      data: result.results.map((game) => this.mapRawgGame(game)),
      meta: {
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit),
      },
    };
  }

  async importFromRawg(externalId: string) {
    // Check if already imported
    const existing = await this.prisma.game.findUnique({
      where: { externalId },
    });

    if (existing) {
      return existing;
    }

    // Fetch from RAWG
    const rawgGame = await this.rawgAdapter.getGameById(externalId);
    if (!rawgGame) {
      throw new NotFoundException('Game not found in RAWG');
    }

    // Create game
    return this.prisma.game.create({
      data: {
        externalId: String(rawgGame.id),
        slug: rawgGame.slug,
        name: rawgGame.name,
        coverImageUrl: rawgGame.background_image,
        description: rawgGame.description_raw || null,
        releaseDate: rawgGame.released ? new Date(rawgGame.released) : null,
        platforms: rawgGame.platforms?.map((p) => p.platform.name) || [],
        genres: rawgGame.genres?.map((g) => g.name) || [],
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: {
          _count: {
            select: { featureRequests: true, gameFollows: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.game.count({ where }),
    ]);

    return {
      data: games.map((g) => ({
        ...g,
        requestsCount: g._count.featureRequests,
        followersCount: g._count.gameFollows,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string, userId?: string) {
    const game = await this.prisma.game.findUnique({
      where: { slug },
      include: {
        devUser: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { featureRequests: true, gameFollows: true },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    let isFollowing = false;
    if (userId) {
      const follow = await this.prisma.follow.findFirst({
        where: {
          followerId: userId,
          gameId: game.id,
          followType: 'GAME',
        },
      });
      isFollowing = !!follow;
    }

    return {
      ...game,
      requestsCount: game._count.featureRequests,
      followersCount: game._count.gameFollows,
      isFollowing,
      _count: undefined,
    };
  }

  async findById(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  private mapRawgGame(game: RawgGame) {
    return {
      externalId: String(game.id),
      slug: game.slug,
      name: game.name,
      coverImageUrl: game.background_image,
      releaseDate: game.released,
      platforms: game.platforms?.map((p) => p.platform.name) || [],
      genres: game.genres?.map((g) => g.name) || [],
    };
  }
}
