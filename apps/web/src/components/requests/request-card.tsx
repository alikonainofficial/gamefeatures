'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ChevronUp, MessageSquare, User } from 'lucide-react';
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
  createdAt: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

interface RequestCardProps {
  request: FeatureRequest;
  onVoteUpdate?: (requestId: string, voted: boolean, voteCount: number) => void;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IMPLEMENTED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
};

export function RequestCard({ request, onVoteUpdate }: RequestCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || isVoting) return;

    setIsVoting(true);
    try {
      const result = await api.post<{ voted: boolean; voteCount: number }>(
        `/requests/${request.id}/upvote`,
        {}
      );
      onVoteUpdate?.(request.id, result.voted, result.voteCount);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Link href={`/requests/${request.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition flex gap-4">
        {/* Vote Button */}
        <button
          onClick={handleVote}
          disabled={!isAuthenticated || isVoting}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg transition ${
            request.hasVoted
              ? 'bg-primary-100 text-primary-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <ChevronUp className={`w-5 h-5 ${request.hasVoted ? 'fill-current' : ''}`} />
          <span className="font-semibold">{request.voteCount}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-semibold text-gray-900 truncate">{request.title}</h3>
            <span
              className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                statusColors[request.status] || statusColors.OPEN
              }`}
            >
              {request.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{request.description}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                request.type === 'ADD_FEATURE'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {request.type === 'ADD_FEATURE' ? '+ Add' : '- Remove'}
            </span>
            <span className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-1" />
              {request.commentsCount}
            </span>
            <span className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              {request.author.username}
            </span>
            <span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
