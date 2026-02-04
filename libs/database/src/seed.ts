import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const RAWG_API_KEY = process.env.RAWG_API_KEY || '';

interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  description_raw?: string;
  released: string | null;
  platforms: Array<{ platform: { name: string } }> | null;
  genres: Array<{ name: string }> | null;
}

async function fetchPopularGames(): Promise<RawgGame[]> {
  if (!RAWG_API_KEY) {
    console.log('RAWG_API_KEY not set, using sample data');
    return getSampleGames();
  }

  try {
    const response = await fetch(
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-rating&page_size=20`
    );
    const data = (await response.json()) as { results?: RawgGame[] };
    return data.results || [];
  } catch (error) {
    console.error('Failed to fetch from RAWG, using sample data:', error);
    return getSampleGames();
  }
}

function getSampleGames(): RawgGame[] {
  return [
    {
      id: 3498,
      slug: 'grand-theft-auto-v',
      name: 'Grand Theft Auto V',
      background_image: 'https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg',
      released: '2013-09-17',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 5' } }],
      genres: [{ name: 'Action' }, { name: 'Adventure' }],
    },
    {
      id: 3328,
      slug: 'the-witcher-3-wild-hunt',
      name: 'The Witcher 3: Wild Hunt',
      background_image: 'https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6f6571.jpg',
      released: '2015-05-18',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 5' } }],
      genres: [{ name: 'RPG' }, { name: 'Action' }],
    },
    {
      id: 4200,
      slug: 'portal-2',
      name: 'Portal 2',
      background_image: 'https://media.rawg.io/media/games/328/3283617cb7d75d67257fc58339188f36.jpg',
      released: '2011-04-18',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 3' } }],
      genres: [{ name: 'Puzzle' }, { name: 'Shooter' }],
    },
    {
      id: 5286,
      slug: 'tomb-raider',
      name: 'Tomb Raider (2013)',
      background_image: 'https://media.rawg.io/media/games/021/021c4e21a1824d2526f925edd27ec1bb.jpg',
      released: '2013-03-05',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 4' } }],
      genres: [{ name: 'Action' }, { name: 'Adventure' }],
    },
    {
      id: 12020,
      slug: 'left-4-dead-2',
      name: 'Left 4 Dead 2',
      background_image: 'https://media.rawg.io/media/games/d58/d588947d4286e7b5e0e12e1bea7d9844.jpg',
      released: '2009-11-17',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'Xbox 360' } }],
      genres: [{ name: 'Shooter' }, { name: 'Action' }],
    },
    {
      id: 28,
      slug: 'red-dead-redemption-2',
      name: 'Red Dead Redemption 2',
      background_image: 'https://media.rawg.io/media/games/511/5118acd89f6e8f9328f1986eae59ecdf.jpg',
      released: '2018-10-26',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 4' } }],
      genres: [{ name: 'Action' }, { name: 'Adventure' }],
    },
    {
      id: 802,
      slug: 'borderlands-2',
      name: 'Borderlands 2',
      background_image: 'https://media.rawg.io/media/games/49c/49c3dfa4ce2f6f140cc4825868e858cb.jpg',
      released: '2012-09-18',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 4' } }],
      genres: [{ name: 'Shooter' }, { name: 'RPG' }],
    },
    {
      id: 13536,
      slug: 'portal',
      name: 'Portal',
      background_image: 'https://media.rawg.io/media/games/7fa/7fa0b586293c5861ee32490e953a4996.jpg',
      released: '2007-10-09',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 3' } }],
      genres: [{ name: 'Puzzle' }, { name: 'Adventure' }],
    },
    {
      id: 4291,
      slug: 'counter-strike-global-offensive',
      name: 'Counter-Strike: Global Offensive',
      background_image: 'https://media.rawg.io/media/games/736/73619bd336c894d6941d926bfd563946.jpg',
      released: '2012-08-21',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 3' } }],
      genres: [{ name: 'Shooter' }, { name: 'Action' }],
    },
    {
      id: 58175,
      slug: 'god-of-war-2',
      name: 'God of War (2018)',
      background_image: 'https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg',
      released: '2018-04-20',
      platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 4' } }],
      genres: [{ name: 'Action' }, { name: 'Adventure' }],
    },
  ];
}

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gamereview.com' },
    update: {},
    create: {
      email: 'admin@gamereview.com',
      username: 'admin',
      passwordHash: adminPassword,
      isAdmin: true,
      userType: 'GAMER',
    },
  });
  console.log('Created admin user:', admin.email);

  // Create sample user
  const userPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'gamer123',
      passwordHash: userPassword,
      userType: 'GAMER',
    },
  });
  console.log('Created sample user:', user.email);

  // Fetch and import popular games
  console.log('Fetching popular games...');
  const games = await fetchPopularGames();

  for (const game of games) {
    const created = await prisma.game.upsert({
      where: { externalId: String(game.id) },
      update: {},
      create: {
        externalId: String(game.id),
        slug: game.slug,
        name: game.name,
        coverImageUrl: game.background_image,
        releaseDate: game.released ? new Date(game.released) : null,
        platforms: game.platforms?.map((p) => p.platform.name) || [],
        genres: game.genres?.map((g) => g.name) || [],
      },
    });
    console.log('Imported game:', created.name);
  }

  // Create sample feature requests
  const gtaGame = await prisma.game.findUnique({
    where: { slug: 'grand-theft-auto-v' },
  });

  if (gtaGame) {
    const request1 = await prisma.featureRequest.upsert({
      where: { id: 'sample-request-1' },
      update: {},
      create: {
        id: 'sample-request-1',
        gameId: gtaGame.id,
        authorId: user.id,
        type: 'ADD_FEATURE',
        title: 'Add cross-platform multiplayer support',
        description: 'It would be great to play GTA Online with friends on different platforms. Many games now support cross-play between PC, PlayStation, and Xbox. This would significantly increase the player pool and make it easier to play with friends.',
        voteCount: 42,
      },
    });
    console.log('Created sample request:', request1.title);

    const request2 = await prisma.featureRequest.upsert({
      where: { id: 'sample-request-2' },
      update: {},
      create: {
        id: 'sample-request-2',
        gameId: gtaGame.id,
        authorId: user.id,
        type: 'ADD_FEATURE',
        title: 'New single-player DLC content',
        description: 'We have been waiting for single-player story DLC for years. The base game story was amazing and we would love to see more of Michael, Trevor, and Franklin adventures. Please consider adding new missions and storylines!',
        voteCount: 128,
      },
    });
    console.log('Created sample request:', request2.title);

    // Create sample comment
    await prisma.comment.upsert({
      where: { id: 'sample-comment-1' },
      update: {},
      create: {
        id: 'sample-comment-1',
        requestId: request1.id,
        authorId: admin.id,
        content: 'This would be amazing! I have friends on PlayStation and I play on PC. We always wished we could play together.',
        likeCount: 5,
      },
    });
    console.log('Created sample comment');

    // Create sample votes
    await prisma.vote.upsert({
      where: { userId_requestId: { userId: admin.id, requestId: request1.id } },
      update: {},
      create: {
        userId: admin.id,
        requestId: request1.id,
      },
    });
    console.log('Created sample vote');
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
