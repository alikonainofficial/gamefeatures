/**
 * `pnpm db:seed`: idempotent demo data (safe to run repeatedly, upserts on stable keys).
 *
 * Environment:
 *   SEED_DEMO_PASSWORD   password for demo_gamer and demo_dev (default "try-the-demo",
 *                        intentionally public: these are the live demo's one-click logins)
 *   SEED_ADMIN_EMAIL     optional; with SEED_ADMIN_PASSWORD, creates/updates an admin
 *   SEED_ADMIN_PASSWORD  in production it must be at least 16 characters
 *   SEED_ADMIN_USERNAME  optional, default "admin"
 *
 * Redis isn't touched: the request ranking index rebuilds itself from Postgres.
 */
import { PrismaClient, RequestStatus, RequestType, User, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEMO_DEV_GAME_SLUG,
  SEED_COMMENTS,
  SEED_GAMES,
  SEED_REQUESTS,
  SEED_VOTER_COUNT,
  SeedAuthor,
  voterUsername,
} from './seed-data';

const prisma = new PrismaClient();

const DEMO_DOMAIN = 'demo.gamefeatures.dev';
const DEFAULT_DEMO_PASSWORD = 'try-the-demo';
const MIN_PRODUCTION_ADMIN_PASSWORD = 16;

/** Accounts the previous seed created with passwords published in the README. */
const LEGACY_SEED_EMAILS = ['admin@gamereview.com', 'user@example.com'];

function readConfig() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || undefined;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || undefined;

  if (
    process.env.NODE_ENV === 'production' &&
    adminPassword !== undefined &&
    adminPassword.length < MIN_PRODUCTION_ADMIN_PASSWORD
  ) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_PRODUCTION_ADMIN_PASSWORD} characters in production.`,
    );
  }
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    console.warn('Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an admin; skipping.');
  }

  return {
    demoPassword: process.env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD,
    admin:
      adminEmail && adminPassword
        ? {
            email: adminEmail,
            password: adminPassword,
            username: process.env.SEED_ADMIN_USERNAME || 'admin',
          }
        : null,
  };
}

async function upsertUser(data: {
  email: string;
  username: string;
  passwordHash: string | null;
  userType?: UserType;
  isAdmin?: boolean;
}) {
  const { email, ...rest } = data;
  return prisma.user.upsert({
    where: { email },
    update: rest,
    create: { email, userType: UserType.GAMER, ...rest },
  });
}

async function main() {
  const config = readConfig();
  const now = Date.now();

  const removed = await prisma.user.deleteMany({ where: { email: { in: LEGACY_SEED_EMAILS } } });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} legacy seed account(s) with published passwords.`);
  }

  // Users
  const demoHash = await bcrypt.hash(config.demoPassword, 10);
  const demoGamer = await upsertUser({
    email: `demo_gamer@${DEMO_DOMAIN}`,
    username: 'demo_gamer',
    passwordHash: demoHash,
  });
  const demoDev = await upsertUser({
    email: `demo_dev@${DEMO_DOMAIN}`,
    username: 'demo_dev',
    passwordHash: demoHash,
    userType: UserType.DEVELOPER,
  });

  const voters: User[] = [];
  for (let n = 1; n <= SEED_VOTER_COUNT; n++) {
    // No password: these accounts exist to vote and comment, nobody can log in as them.
    voters.push(
      await upsertUser({
        email: `${voterUsername(n)}@${DEMO_DOMAIN}`,
        username: voterUsername(n),
        passwordHash: null,
      }),
    );
  }

  if (config.admin) {
    await upsertUser({
      email: config.admin.email,
      username: config.admin.username,
      passwordHash: await bcrypt.hash(config.admin.password, 10),
      isAdmin: true,
    });
  }

  const userIdFor = (author: SeedAuthor): string =>
    author === 'demo_gamer' ? demoGamer.id : author === 'demo_dev' ? demoDev.id : voters[author - 1].id;

  // Games
  const gameIdBySlug = new Map<string, string>();
  for (const game of SEED_GAMES) {
    const isDemoDevGame = game.slug === DEMO_DEV_GAME_SLUG;
    const data = {
      slug: game.slug,
      name: game.name,
      coverImageUrl: game.coverImageUrl,
      releaseDate: new Date(game.released),
      platforms: game.platforms,
      genres: game.genres,
      ...(isDemoDevGame ? { devUserId: demoDev.id, isVerified: true } : {}),
    };
    const saved = await prisma.game.upsert({
      where: { externalId: game.externalId },
      update: data,
      create: { externalId: game.externalId, ...data },
    });
    gameIdBySlug.set(game.slug, saved.id);
  }

  // Requests (createdAt is only set on first insert, so re-runs don't reshuffle "new")
  for (const r of SEED_REQUESTS) {
    const createdAt = new Date(now - r.ageHours * 3_600_000);
    const content = {
      type: r.type as RequestType,
      title: r.title,
      description: r.description,
      status: r.status as RequestStatus,
      devResponse: r.devResponse ?? null,
    };
    await prisma.featureRequest.upsert({
      where: { id: r.id },
      update: content,
      create: {
        id: r.id,
        gameId: gameIdBySlug.get(r.game)!,
        authorId: userIdFor(r.author),
        createdAt,
        devRespondedAt: r.devResponse ? new Date(createdAt.getTime() + 24 * 3_600_000) : null,
        ...content,
      },
    });

    const voterIds = voters.slice(0, r.votes).map((v) => v.id);
    if (r.demoGamerVoted) voterIds.push(demoGamer.id);
    await prisma.vote.createMany({
      data: voterIds.map((userId) => ({ userId, requestId: r.id })),
      skipDuplicates: true,
    });
  }

  // Comments (parents are listed before their replies)
  for (const c of SEED_COMMENTS) {
    await prisma.comment.upsert({
      where: { id: c.id },
      update: { content: c.content },
      create: {
        id: c.id,
        requestId: c.request,
        authorId: userIdFor(c.author),
        parentId: c.parent ?? null,
        content: c.content,
      },
    });
    await prisma.commentLike.createMany({
      data: voters.slice(0, c.likes).map((v) => ({ userId: v.id, commentId: c.id })),
      skipDuplicates: true,
    });
  }

  // Denormalized counters always match their rows (including votes/likes by real users).
  await prisma.$executeRaw`
    UPDATE "FeatureRequest" fr
    SET "voteCount" = (SELECT COUNT(*) FROM "Vote" v WHERE v."requestId" = fr.id)
  `;
  await prisma.$executeRaw`
    UPDATE "Comment" c
    SET "likeCount" = (SELECT COUNT(*) FROM "CommentLike" l WHERE l."commentId" = c.id)
  `;

  const summary = {
    users: await prisma.user.count(),
    games: await prisma.game.count(),
    requests: await prisma.featureRequest.count(),
    votes: await prisma.vote.count(),
    comments: await prisma.comment.count(),
    commentLikes: await prisma.commentLike.count(),
  };
  console.log('Seed complete:', summary);
  console.log(`Demo logins: demo_gamer / demo_dev (password from SEED_DEMO_PASSWORD).`);
  if (config.admin) console.log(`Admin: ${config.admin.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
