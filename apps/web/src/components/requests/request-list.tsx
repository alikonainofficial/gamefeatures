'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RequestCard } from './request-card';

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

interface RequestsResponse {
  data: FeatureRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface RequestListProps {
  gameSlug: string;
  gameId: string;
}

type SortOption = 'hot' | 'top' | 'new';

export function RequestList({ gameSlug, gameId }: RequestListProps) {
  // Refetch once the session is restored (or on login/logout) so per-user flags such as
  // hasVoted reflect the signed-in user, not an anonymous visitor.
  const viewerId = useAuthStore((s) => s.user?.id);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('hot');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      try {
        const response = await api.get<RequestsResponse>(
          `/games/${gameSlug}/requests?sort=${sort}&page=${page}&limit=10`
        );
        setRequests(response.data);
        setTotalPages(response.meta.totalPages);
      } catch (error) {
        console.error('Failed to fetch requests:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRequests();
  }, [gameSlug, sort, page, viewerId]);

  const handleVoteUpdate = (requestId: string, voted: boolean, voteCount: number) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, hasVoted: voted, voteCount } : r
      )
    );
  };

  return (
    <div>
      {/* Sort Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-gray-500 mr-2">Sort by:</span>
        {(['hot', 'top', 'new'] as SortOption[]).map((option) => (
          <button
            key={option}
            onClick={() => {
              setSort(option);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
              sort === option
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Requests */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-600">No feature requests yet. Be the first to submit one!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onVoteUpdate={handleVoteUpdate}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
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
    </div>
  );
}
