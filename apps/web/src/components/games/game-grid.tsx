'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { GameCard } from './game-card';

interface Game {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
  requestsCount: number;
  followersCount: number;
}

interface GamesResponse {
  data: Game[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function GameGrid() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      try {
        const response = await api.get<GamesResponse>('/games?limit=8');
        setGames(response.data);
      } catch (error) {
        console.error('Failed to fetch games:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGames();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-200 rounded-lg h-64 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
