import { GatewayTimeoutException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { positiveInt } from '../../../common/throttle';

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  description_raw?: string;
  released: string | null;
  platforms: Array<{ platform: { id: number; name: string; slug: string } }> | null;
  genres: Array<{ id: number; name: string; slug: string }> | null;
}

export interface RawgSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawgGame[];
}

@Injectable()
export class RawgAdapter {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.rawg.io/api';
  /** Upper bound for one RAWG call, so a slow upstream can't hold requests open. */
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('RAWG_API_KEY') || '';
    this.timeoutMs = positiveInt(this.configService.get('RAWG_TIMEOUT_MS'), 5000);
  }

  async searchGames(query: string, page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    const url = `${this.baseUrl}/games?key=${this.apiKey}&search=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;
    return (await this.getJson<RawgSearchResponse>(url, 'Failed to search RAWG API'))!;
  }

  async getGameById(externalId: string): Promise<RawgGame | null> {
    const url = `${this.baseUrl}/games/${encodeURIComponent(externalId)}?key=${this.apiKey}`;
    return this.getJson<RawgGame>(url, 'Failed to fetch game from RAWG API', { notFoundAsNull: true });
  }

  async getPopularGames(page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    const url = `${this.baseUrl}/games?key=${this.apiKey}&ordering=-rating&page=${page}&page_size=${pageSize}`;
    return (await this.getJson<RawgSearchResponse>(url, 'Failed to fetch popular games from RAWG API'))!;
  }

  /** GET + JSON with a timeout. Timeout → 504, other upstream/network failures → 502. */
  private async getJson<T>(
    url: string,
    failureMessage: string,
    { notFoundAsNull = false }: { notFoundAsNull?: boolean } = {},
  ): Promise<T | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) {
        if (notFoundAsNull && response.status === 404) return null;
        throw new HttpException(failureMessage, HttpStatus.BAD_GATEWAY);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // AbortSignal.timeout() rejects with a DOMException named TimeoutError.
      if ((error as { name?: string } | null)?.name === 'TimeoutError') {
        throw new GatewayTimeoutException('RAWG API did not respond in time');
      }
      throw new HttpException('Failed to connect to RAWG API', HttpStatus.BAD_GATEWAY);
    }
  }
}
