'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { GameCard } from '@/components/games/game-card';
import { SearchBar } from '@/components/search/search-bar';

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

export default function GamesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Games</h1>
        <SearchBar />
      </div>

      {/* useSearchParams() needs a Suspense boundary, or `next build` fails to prerender this page. */}
      <Suspense fallback={<GamesGridSkeleton />}>
        <GamesResults />
      </Suspense>
    </div>
  );
}

function GamesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-lg h-64 animate-pulse" />
      ))}
    </div>
  );
}

function GamesResults() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchGames() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '12',
        });
        if (search) {
          params.set('search', search);
        }
        const response = await api.get<GamesResponse>(`/games?${params}`);
        setGames(response.data);
        setTotalPages(response.meta.totalPages);
      } catch (error) {
        console.error('Failed to fetch games:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGames();
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <>
      {search && (
        <p className="text-gray-600 mb-6">
          Showing results for &quot;<span className="font-medium">{search}</span>&quot;
        </p>
      )}

      {isLoading ? (
        <GamesGridSkeleton />
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No games found.</p>
          {search && (
            <p className="text-gray-500 mt-2">
              Try searching with different keywords or{' '}
              <a href="/games" className="text-primary-600 hover:underline">
                browse all games
              </a>
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
