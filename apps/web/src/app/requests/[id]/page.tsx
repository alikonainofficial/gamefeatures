'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { WS_EVENTS } from '@game-review/shared';
import { CommentSection } from '@/components/comments/comment-section';
import { ChevronUp, ArrowLeft, User, Clock, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  type: 'ADD_FEATURE' | 'REMOVE_FEATURE';
  status: string;
  voteCount: number;
  hasVoted: boolean;
  commentsCount: number;
  devResponse: string | null;
  devRespondedAt: string | null;
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

const statusColors: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IMPLEMENTED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
};

export default function RequestPage() {
  const params = useParams();
  const id = params.id as string;
  const [request, setRequest] = useState<FeatureRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const { socket, subscribe, unsubscribe } = useSocket();

  // Live vote count from other viewers. The socket needs a signed-in user; anonymous
  // visitors just see the count from page load.
  useEffect(() => {
    if (!socket || !id) return;
    const room = `request:${id}`;
    const onVoteUpdate = (update: { requestId: string; voteCount: number }) => {
      if (update.requestId !== id) return;
      setRequest((prev) => (prev ? { ...prev, voteCount: update.voteCount } : prev));
    };

    socket.on(WS_EVENTS.voteUpdate, onVoteUpdate);
    subscribe(room);
    return () => {
      socket.off(WS_EVENTS.voteUpdate, onVoteUpdate);
      unsubscribe(room);
    };
  }, [socket, id, subscribe, unsubscribe]);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function fetchRequest() {
      try {
        const data = await api.get<FeatureRequest>(`/requests/${id}`);
        setRequest(data);
      } catch (error) {
        console.error('Failed to fetch request:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRequest();
  }, [id]);

  const handleVote = async () => {
    if (!isAuthenticated || isVoting || !request) return;

    setIsVoting(true);
    try {
      const path = `/requests/${id}/vote`;
      const result = request.hasVoted
        ? await api.delete<{ voted: boolean; voteCount: number }>(path)
        : await api.put<{ voted: boolean; voteCount: number }>(path);
      setRequest((prev) =>
        prev ? { ...prev, hasVoted: result.voted, voteCount: result.voteCount } : prev
      );
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Request not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={`/games/${request.game.slug}`}
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to {request.game.name}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              {/* Vote Button */}
              <button
                onClick={handleVote}
                disabled={!isAuthenticated || isVoting}
                className={`flex flex-col items-center justify-center w-20 h-20 rounded-lg transition ${
                  request.hasVoted
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <ChevronUp className={`w-6 h-6 ${request.hasVoted ? 'fill-current' : ''}`} />
                <span className="font-bold text-lg">{request.voteCount}</span>
              </button>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap ${
                      statusColors[request.status] || statusColors.OPEN
                    }`}
                  >
                    {request.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
                  <span
                    className={`px-2 py-1 rounded ${
                      request.type === 'ADD_FEATURE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {request.type === 'ADD_FEATURE' ? '+ Add Feature' : '- Remove Feature'}
                  </span>
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    <Link
                      href={`/users/${request.author.username}`}
                      className="hover:underline"
                    >
                      {request.author.username}
                    </Link>
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </span>
                  <span className="flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    {request.commentsCount} comments
                  </span>
                </div>

                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{request.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dev Response */}
          {request.devResponse && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <span className="bg-green-600 text-white px-2 py-1 rounded text-sm font-medium">
                  Dev Response
                </span>
                {request.devRespondedAt && (
                  <span className="ml-3 text-sm text-gray-500">
                    {formatDistanceToNow(new Date(request.devRespondedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{request.devResponse}</p>
            </div>
          )}

          {/* Comments */}
          <CommentSection requestId={id} />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-4">Game</h3>
            <Link
              href={`/games/${request.game.slug}`}
              className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg"
            >
              {request.game.coverImageUrl && (
                <img
                  src={request.game.coverImageUrl}
                  alt={request.game.name}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <span className="font-medium">{request.game.name}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
