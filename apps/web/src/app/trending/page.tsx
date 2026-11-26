'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RequestCard } from '@/components/requests/request-card';
import { TrendingUp, Flame } from 'lucide-react';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  type: 'ADD_FEATURE' | 'REMOVE_FEATURE';
  status: string;
  voteCount: number;
  hasVoted: boolean;
  commentsCount: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  game: {
    id: string;
    slug: string;
    name: string;
    coverImageUrl: string | null;
  };
}

interface Game {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  requestsCount: number;
  followersCount: number;
}

export default function TrendingPage() {
  // Refetch once the session is restored (or on login/logout) so per-user flags such as
  // hasVoted reflect the signed-in user, not an anonymous visitor.
  const viewerId = useAuthStore((s) => s.user?.id);
  const [topRequests, setTopRequests] = useState<FeatureRequest[]>([]);
  const [popularGames, setPopularGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const [gamesResponse] = await Promise.all([
          api.get<{ data: Game[] }>('/games?limit=6'),
        ]);
        setPopularGames(gamesResponse.data);

        // Fetch top requests from each popular game
        const allRequests: FeatureRequest[] = [];
        for (const game of gamesResponse.data.slice(0, 3)) {
          try {
            const requestsResponse = await api.get<{ data: FeatureRequest[] }>(
              `/games/${game.slug}/requests?sort=top&limit=3`
            );
            allRequests.push(
              ...requestsResponse.data.map((r) => ({
                ...r,
                game: {
                  id: game.id,
                  slug: game.slug,
                  name: game.name,
                  coverImageUrl: game.coverImageUrl,
                },
              }))
            );
          } catch (e) {
            // Skip if game has no requests
          }
        }
        setTopRequests(allRequests.sort((a, b) => b.voteCount - a.voteCount).slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch trending:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrending();
  }, [viewerId]);

  const handleVoteUpdate = (requestId: string, voted: boolean, voteCount: number) => {
    setTopRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, hasVoted: voted, voteCount } : r
      )
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded" />
              ))}
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Flame className="w-8 h-8 text-orange-500" />
        <h1 className="text-3xl font-bold text-gray-900">Trending</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Requests */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Top Requests</h2>
          </div>

          {topRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No trending requests yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topRequests.map((request) => (
                <div key={request.id}>
                  <Link
                    href={`/games/${request.game.slug}`}
                    className="text-sm text-gray-500 hover:text-primary-600 mb-1 inline-block"
                  >
                    {request.game.name}
                  </Link>
                  <RequestCard
                    request={request}
                    onVoteUpdate={handleVoteUpdate}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular Games */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Games</h2>
          <div className="space-y-3">
            {popularGames.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.slug}`}
                className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition"
              >
                {game.coverImageUrl ? (
                  <img
                    src={game.coverImageUrl}
                    alt={game.name}
                    className="w-16 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-16 h-12 rounded bg-gray-200" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{game.name}</h3>
                  <p className="text-sm text-gray-500">
                    {game.requestsCount} requests
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
