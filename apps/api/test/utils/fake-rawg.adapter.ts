import { RawgGame, RawgSearchResponse } from '../../src/modules/games/game-api/rawg.adapter';

/** In-memory stand-in for RawgAdapter so tests never call the real RAWG API. */
export class FakeRawgAdapter {
  private readonly games = new Map<string, RawgGame>();

  add(game: Partial<RawgGame> & Pick<RawgGame, 'id' | 'name'>): RawgGame {
    const full: RawgGame = {
      slug: game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      background_image: null,
      description_raw: '',
      released: null,
      platforms: [],
      genres: [],
      ...game,
    };
    this.games.set(String(full.id), full);
    return full;
  }

  clear(): void {
    this.games.clear();
  }

  async searchGames(query: string, page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    const matches = [...this.games.values()].filter((g) =>
      g.name.toLowerCase().includes(query.toLowerCase()),
    );
    return this.paginate(matches, page, pageSize);
  }

  async getGameById(externalId: string): Promise<RawgGame | null> {
    return this.games.get(externalId) ?? null;
  }

  async getPopularGames(page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    return this.paginate([...this.games.values()], page, pageSize);
  }

  private paginate(items: RawgGame[], page: number, pageSize: number): RawgSearchResponse {
    const start = (page - 1) * pageSize;
    return {
      count: items.length,
      next: null,
      previous: null,
      results: items.slice(start, start + pageSize),
    };
  }
}
