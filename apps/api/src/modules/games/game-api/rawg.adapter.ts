import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('RAWG_API_KEY') || '';
  }

  async searchGames(query: string, page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    const url = `${this.baseUrl}/games?key=${this.apiKey}&search=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new HttpException('Failed to search RAWG API', HttpStatus.BAD_GATEWAY);
      }
      return response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to connect to RAWG API', HttpStatus.BAD_GATEWAY);
    }
  }

  async getGameById(externalId: string): Promise<RawgGame | null> {
    const url = `${this.baseUrl}/games/${externalId}?key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new HttpException('Failed to fetch game from RAWG API', HttpStatus.BAD_GATEWAY);
      }
      return response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to connect to RAWG API', HttpStatus.BAD_GATEWAY);
    }
  }

  async getPopularGames(page = 1, pageSize = 20): Promise<RawgSearchResponse> {
    const url = `${this.baseUrl}/games?key=${this.apiKey}&ordering=-rating&page=${page}&page_size=${pageSize}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new HttpException('Failed to fetch popular games from RAWG API', HttpStatus.BAD_GATEWAY);
      }
      return response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to connect to RAWG API', HttpStatus.BAD_GATEWAY);
    }
  }
}
