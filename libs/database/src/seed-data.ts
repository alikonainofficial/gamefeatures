/**
 * Demo content for `pnpm db:seed`. Everything has a stable key so re-running the seed
 * updates in place instead of duplicating rows.
 */

export interface SeedGame {
  externalId: string;
  slug: string;
  name: string;
  coverImageUrl: string;
  released: string;
  platforms: string[];
  genres: string[];
}

export const SEED_GAMES: SeedGame[] = [
  { externalId: '3498', slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V', coverImageUrl: 'https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg', released: '2013-09-17', platforms: ['PC', 'PlayStation 5'], genres: ['Action', 'Adventure'] },
  { externalId: '3328', slug: 'the-witcher-3-wild-hunt', name: 'The Witcher 3: Wild Hunt', coverImageUrl: 'https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6f6571.jpg', released: '2015-05-18', platforms: ['PC', 'PlayStation 5'], genres: ['RPG', 'Action'] },
  { externalId: '4200', slug: 'portal-2', name: 'Portal 2', coverImageUrl: 'https://media.rawg.io/media/games/328/3283617cb7d75d67257fc58339188f36.jpg', released: '2011-04-18', platforms: ['PC', 'PlayStation 3'], genres: ['Puzzle', 'Shooter'] },
  { externalId: '5286', slug: 'tomb-raider', name: 'Tomb Raider (2013)', coverImageUrl: 'https://media.rawg.io/media/games/021/021c4e21a1824d2526f925edd27ec1bb.jpg', released: '2013-03-05', platforms: ['PC', 'PlayStation 4'], genres: ['Action', 'Adventure'] },
  { externalId: '12020', slug: 'left-4-dead-2', name: 'Left 4 Dead 2', coverImageUrl: 'https://media.rawg.io/media/games/d58/d588947d4286e7b5e0e12e1bea7d9844.jpg', released: '2009-11-17', platforms: ['PC', 'Xbox 360'], genres: ['Shooter', 'Action'] },
  { externalId: '28', slug: 'red-dead-redemption-2', name: 'Red Dead Redemption 2', coverImageUrl: 'https://media.rawg.io/media/games/511/5118acd89f6e8f9328f1986eae59ecdf.jpg', released: '2018-10-26', platforms: ['PC', 'PlayStation 4'], genres: ['Action', 'Adventure'] },
  { externalId: '802', slug: 'borderlands-2', name: 'Borderlands 2', coverImageUrl: 'https://media.rawg.io/media/games/49c/49c3dfa4ce2f6f140cc4825868e858cb.jpg', released: '2012-09-18', platforms: ['PC', 'PlayStation 4'], genres: ['Shooter', 'RPG'] },
  { externalId: '13536', slug: 'portal', name: 'Portal', coverImageUrl: 'https://media.rawg.io/media/games/7fa/7fa0b586293c5861ee32490e953a4996.jpg', released: '2007-10-09', platforms: ['PC', 'PlayStation 3'], genres: ['Puzzle', 'Adventure'] },
  { externalId: '4291', slug: 'counter-strike-global-offensive', name: 'Counter-Strike: Global Offensive', coverImageUrl: 'https://media.rawg.io/media/games/736/73619bd336c894d6941d926bfd563946.jpg', released: '2012-08-21', platforms: ['PC', 'PlayStation 3'], genres: ['Shooter', 'Action'] },
  { externalId: '58175', slug: 'god-of-war-2', name: 'God of War (2018)', coverImageUrl: 'https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg', released: '2018-04-20', platforms: ['PC', 'PlayStation 4'], genres: ['Action', 'Adventure'] },
];

/** demo_dev manages this game (verified developer access). */
export const DEMO_DEV_GAME_SLUG = 'portal-2';

/** Seeded voters/commenters. They have no password and can't log in. */
export const SEED_VOTER_COUNT = 15;
export const voterUsername = (n: number) => `seed_voter_${String(n).padStart(2, '0')}`;

/** Who wrote something: a demo account or seed voter N (1-based). */
export type SeedAuthor = 'demo_gamer' | 'demo_dev' | number;

type Status = 'OPEN' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'DECLINED';

export interface SeedRequest {
  id: string;
  game: string;
  author: SeedAuthor;
  type: 'ADD_FEATURE' | 'REMOVE_FEATURE';
  title: string;
  description: string;
  status: Status;
  devResponse?: string;
  /** Votes come from seed voters 1..votes (real Vote rows; voteCount is recomputed). */
  votes: number;
  /** Also voted by demo_gamer. */
  demoGamerVoted?: boolean;
  /** Age at first seed, in hours. */
  ageHours: number;
}

export const SEED_REQUESTS: SeedRequest[] = [
  // Portal 2 (managed by demo_dev, so it has developer responses)
  { id: 'seed-req-01', game: 'portal-2', author: 3, type: 'ADD_FEATURE', title: 'Official level editor for console players', description: 'The Perpetual Testing Initiative editor is PC-only. Bringing it to consoles would give the community a lot more chambers to play.', status: 'IN_PROGRESS', devResponse: 'We are prototyping a controller-friendly editor right now. Expect a beta for testers soon.', votes: 14, demoGamerVoted: true, ageHours: 24 * 20 },
  { id: 'seed-req-02', game: 'portal-2', author: 'demo_gamer', type: 'ADD_FEATURE', title: 'Online co-op matchmaking with strangers', description: 'Co-op currently needs a friend. A simple matchmaking queue for the co-op campaign would help solo players experience it.', status: 'UNDER_REVIEW', devResponse: 'Reviewing this with the network team. Server costs are the main question.', votes: 11, ageHours: 24 * 9 },
  { id: 'seed-req-03', game: 'portal-2', author: 5, type: 'ADD_FEATURE', title: 'Speedrun timer in the options menu', description: 'An in-game timer with splits per chamber would make speedrunning much more accessible without external tools.', status: 'IMPLEMENTED', devResponse: 'Shipped in the latest patch under Options > Gameplay > Show timer. Thanks for the idea!', votes: 9, ageHours: 24 * 45 },
  { id: 'seed-req-04', game: 'portal-2', author: 8, type: 'REMOVE_FEATURE', title: 'Remove the forced tutorial on new saves', description: 'Every new save forces the opening tutorial again. Experienced players should be able to skip straight to chapter two.', status: 'OPEN', votes: 6, ageHours: 30 },
  { id: 'seed-req-05', game: 'portal-2', author: 11, type: 'ADD_FEATURE', title: 'Colorblind-friendly portal colours', description: 'Blue and orange are hard to tell apart for some players. A palette option for portals and lasers would help a lot.', status: 'UNDER_REVIEW', votes: 12, ageHours: 24 * 3 },
  { id: 'seed-req-06', game: 'portal-2', author: 2, type: 'ADD_FEATURE', title: 'Bring back the commentary mode', description: 'A developer commentary mode, like the original Portal, would be a great reason to replay the campaign.', status: 'DECLINED', devResponse: 'We love the idea, but the original team is not available to record new commentary. Sorry!', votes: 4, ageHours: 24 * 60 },

  // Grand Theft Auto V
  { id: 'seed-req-07', game: 'grand-theft-auto-v', author: 1, type: 'ADD_FEATURE', title: 'Cross-platform multiplayer for GTA Online', description: 'Friends on PC, PlayStation and Xbox should be able to play GTA Online together. A bigger player pool helps everyone.', status: 'OPEN', votes: 15, demoGamerVoted: true, ageHours: 24 * 14 },
  { id: 'seed-req-08', game: 'grand-theft-auto-v', author: 4, type: 'ADD_FEATURE', title: 'New single-player story DLC', description: 'The story campaign was excellent. More missions for Michael, Trevor and Franklin would be very welcome.', status: 'OPEN', votes: 13, ageHours: 24 * 30 },
  { id: 'seed-req-09', game: 'grand-theft-auto-v', author: 'demo_gamer', type: 'REMOVE_FEATURE', title: 'Remove the phone call interruptions during missions', description: 'Random contacts calling in the middle of chases breaks immersion. Please let us silence calls during missions.', status: 'OPEN', votes: 7, ageHours: 20 },
  { id: 'seed-req-10', game: 'grand-theft-auto-v', author: 6, type: 'ADD_FEATURE', title: 'Photo mode with free camera', description: 'The Snapmatic camera is fun but limited. A proper photo mode with a free camera and filters would be great for screenshots.', status: 'OPEN', votes: 5, ageHours: 6 },
  { id: 'seed-req-11', game: 'grand-theft-auto-v', author: 9, type: 'ADD_FEATURE', title: 'Garage sorting and search', description: 'With hundreds of cars, finding one in the garage takes ages. Sorting by class and a search box would fix it.', status: 'OPEN', votes: 2, ageHours: 2 },

  // The Witcher 3
  { id: 'seed-req-12', game: 'the-witcher-3-wild-hunt', author: 7, type: 'ADD_FEATURE', title: 'Transmog for armour sets', description: 'Let us keep the stats of the best armour while showing the look of a favourite set. Geralt deserves to look good.', status: 'OPEN', votes: 13, demoGamerVoted: true, ageHours: 24 * 8 },
  { id: 'seed-req-13', game: 'the-witcher-3-wild-hunt', author: 10, type: 'ADD_FEATURE', title: 'Gwent deck sharing codes', description: 'Share Gwent decks with friends using a short code, so new players can try strong decks without grinding cards.', status: 'OPEN', votes: 8, ageHours: 24 * 2 },
  { id: 'seed-req-14', game: 'the-witcher-3-wild-hunt', author: 'demo_gamer', type: 'REMOVE_FEATURE', title: 'Remove item weight limit on Roach', description: 'Inventory management takes too long. Saddlebags should hold far more, or weight should be optional.', status: 'OPEN', votes: 10, ageHours: 24 * 25 },
  { id: 'seed-req-15', game: 'the-witcher-3-wild-hunt', author: 12, type: 'ADD_FEATURE', title: 'Mark read books in the inventory', description: 'Books you have already read look the same as new ones. A small marker would save a lot of guessing.', status: 'OPEN', votes: 3, ageHours: 12 },

  // Red Dead Redemption 2
  { id: 'seed-req-16', game: 'red-dead-redemption-2', author: 13, type: 'ADD_FEATURE', title: 'Faster travel between camps', description: 'Riding across the map is beautiful the first time, less so the tenth. A paid stagecoach option from camp would help.', status: 'OPEN', votes: 9, ageHours: 24 * 5 },
  { id: 'seed-req-17', game: 'red-dead-redemption-2', author: 14, type: 'REMOVE_FEATURE', title: 'Remove the slow looting animations', description: 'Looting every drawer one animation at a time is tedious. An option for quick looting would be appreciated.', status: 'OPEN', votes: 12, ageHours: 24 * 18 },
  { id: 'seed-req-18', game: 'red-dead-redemption-2', author: 2, type: 'ADD_FEATURE', title: 'More camp customization', description: 'Let us choose the camp layout and decorations. It is our home for most of the game.', status: 'OPEN', votes: 4, ageHours: 24 * 1 },
  { id: 'seed-req-19', game: 'red-dead-redemption-2', author: 'demo_gamer', type: 'ADD_FEATURE', title: 'Hardcore survival mode', description: 'Stricter needs for food, sleep and weather would make the frontier feel more dangerous. Optional, of course.', status: 'OPEN', votes: 6, ageHours: 40 },
  { id: 'seed-req-20', game: 'red-dead-redemption-2', author: 15, type: 'ADD_FEATURE', title: 'Fishing tournaments in online mode', description: 'Weekly fishing tournaments with leaderboards would give relaxed players something fun to compete in.', status: 'OPEN', votes: 1, ageHours: 4 },

  // Borderlands 2
  { id: 'seed-req-21', game: 'borderlands-2', author: 1, type: 'ADD_FEATURE', title: 'Loot filter for common weapons', description: 'Late game, most drops are white and green weapons. A loot filter would stop them cluttering the screen.', status: 'OPEN', votes: 11, ageHours: 24 * 11 },
  { id: 'seed-req-22', game: 'borderlands-2', author: 3, type: 'ADD_FEATURE', title: 'Shared bank between characters', description: 'Moving legendary gear between characters needs a second player today. A shared bank would make alts much easier.', status: 'OPEN', votes: 14, ageHours: 24 * 33 },
  { id: 'seed-req-23', game: 'borderlands-2', author: 'demo_gamer', type: 'REMOVE_FEATURE', title: 'Remove the long elevator rides', description: 'Some areas have long elevator and loading sections. Cutting them down would make farming runs faster.', status: 'OPEN', votes: 5, ageHours: 24 * 4 },
  { id: 'seed-req-24', game: 'borderlands-2', author: 6, type: 'ADD_FEATURE', title: 'Split-screen for four players on PC', description: 'Console has split-screen, PC does not. Couch co-op on PC with controllers would be a lot of fun.', status: 'OPEN', votes: 8, ageHours: 24 * 7 },
  { id: 'seed-req-25', game: 'borderlands-2', author: 9, type: 'ADD_FEATURE', title: 'Ultra-wide monitor support', description: 'On 21:9 screens the HUD is stretched or cut off. Proper ultra-wide support would make the game look great.', status: 'OPEN', votes: 3, ageHours: 10 },
];

export interface SeedComment {
  id: string;
  request: string;
  author: SeedAuthor;
  content: string;
  parent?: string;
  /** Liked by seed voters 1..likes (real CommentLike rows; likeCount is recomputed). */
  likes: number;
}

export const SEED_COMMENTS: SeedComment[] = [
  { id: 'seed-com-01', request: 'seed-req-01', author: 4, content: 'This would keep the game alive for years. The community chambers are the best part.', likes: 6 },
  { id: 'seed-com-02', request: 'seed-req-01', author: 'demo_dev', parent: 'seed-com-01', content: 'Agreed! The beta will include the full test element set.', likes: 9 },
  { id: 'seed-com-03', request: 'seed-req-01', author: 'demo_gamer', parent: 'seed-com-02', content: 'Can testers sign up somewhere?', likes: 2 },
  { id: 'seed-com-04', request: 'seed-req-03', author: 7, content: 'Just tried it, the splits per chamber are perfect.', likes: 4 },
  { id: 'seed-com-05', request: 'seed-req-07', author: 'demo_gamer', content: 'Half my friends moved to PC. Please make this happen.', likes: 8 },
  { id: 'seed-com-06', request: 'seed-req-07', author: 10, parent: 'seed-com-05', content: 'Same here. Aim assist settings per platform would make it fair.', likes: 3 },
  { id: 'seed-com-07', request: 'seed-req-12', author: 11, content: 'The Grandmaster sets look great but some early armour has much better style.', likes: 5 },
  { id: 'seed-com-08', request: 'seed-req-14', author: 2, content: 'A middle ground: double the limit and make horse bags cheaper.', likes: 1 },
  { id: 'seed-com-09', request: 'seed-req-17', author: 'demo_gamer', content: 'Even a hold-to-loot-all button would be enough.', likes: 7 },
  { id: 'seed-com-10', request: 'seed-req-17', author: 13, parent: 'seed-com-09', content: 'Yes, and skip the animation on the second visit.', likes: 2 },
  { id: 'seed-com-11', request: 'seed-req-22', author: 5, content: 'Mule characters are such a hassle. Shared bank please.', likes: 4 },
  { id: 'seed-com-12', request: 'seed-req-22', author: 'demo_gamer', parent: 'seed-com-11', content: 'The Pre-Sequel had a stash too, so it should be doable.', likes: 0 },
];
