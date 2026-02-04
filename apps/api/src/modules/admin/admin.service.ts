import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserType } from '@game-review/database';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async grantDevAccess(gameId: string, userId: string) {
    // Verify game exists
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.devUserId) {
      throw new BadRequestException('Game already has a dev user assigned');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update game and user
    const [updatedGame] = await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: {
          devUserId: userId,
          isVerified: true,
        },
        include: {
          devUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { userType: UserType.DEVELOPER },
      }),
    ]);

    return updatedGame;
  }

  async revokeDevAccess(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (!game.devUserId) {
      throw new BadRequestException('Game has no dev user assigned');
    }

    const devUserId = game.devUserId;

    // Check if user has other games
    const otherGames = await this.prisma.game.count({
      where: {
        devUserId: devUserId,
        id: { not: gameId },
      },
    });

    // Update game
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        devUserId: null,
        isVerified: false,
      },
    });

    // If user has no other games, revert to GAMER
    if (otherGames === 0) {
      await this.prisma.user.update({
        where: { id: devUserId },
        data: { userType: UserType.GAMER },
      });
    }

    return { success: true };
  }

  async listGamesWithDevAccess(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where: { devUserId: { not: null } },
        include: {
          devUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.game.count({
        where: { devUserId: { not: null } },
      }),
    ]);

    return {
      data: games,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async makeUserAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
      },
    });
  }
}
