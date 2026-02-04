'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RequestList } from '@/components/requests/request-list';
import { CreateRequestModal } from '@/components/requests/create-request-modal';
import { Users, MessageSquare, Plus, Heart } from 'lucide-react';

interface Game {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  description: string | null;
  platforms: string[];
  genres: string[];
  requestsCount: number;
  followersCount: number;
  isFollowing: boolean;
  isVerified: boolean;
  devUser: { id: string; username: string } | null;
}

export default function GamePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function fetchGame() {
      try {
        const data = await api.get<Game>(`/games/${slug}`);
        setGame(data);
        setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error('Failed to fetch game:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGame();
  }, [slug]);

  const handleFollowToggle = async () => {
    if (!game || !isAuthenticated) return;

    try {
      const result = await api.post<{ following: boolean }>(`/follows/games/${game.id}`, {});
      setIsFollowing(result.following);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-lg mb-6" />
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Game not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Game Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="relative h-64 md:h-80">
          {game.coverImageUrl ? (
            <Image
              src={game.coverImageUrl}
              alt={game.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-xl">No Image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{game.name}</h1>
            <div className="flex flex-wrap gap-2">
              {game.genres.map((genre) => (
                <span
                  key={genre}
                  className="bg-white/20 px-3 py-1 rounded-full text-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center text-gray-600">
                <MessageSquare className="w-5 h-5 mr-2" />
                <span>{game.requestsCount} requests</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Users className="w-5 h-5 mr-2" />
                <span>{game.followersCount} followers</span>
              </div>
              {game.isVerified && (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Verified Dev Team
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {isAuthenticated && (
                <button
                  onClick={handleFollowToggle}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition ${
                    isFollowing
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 mr-2 ${isFollowing ? 'fill-current' : ''}`}
                  />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {isAuthenticated && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Request
                </button>
              )}
            </div>
          </div>

          {game.description && (
            <p className="mt-4 text-gray-600 line-clamp-3">{game.description}</p>
          )}
        </div>
      </div>

      {/* Feature Requests */}
      <RequestList gameSlug={slug} gameId={game.id} />

      {/* Create Request Modal */}
      {showCreateModal && (
        <CreateRequestModal
          gameId={game.id}
          gameName={game.name}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            // Refresh requests
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
