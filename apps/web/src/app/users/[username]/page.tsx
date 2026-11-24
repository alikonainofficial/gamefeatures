'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RequestCard } from '@/components/requests/request-card';
import { User, Calendar, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  userType: 'GAMER' | 'DEVELOPER';
  createdAt: string;
  followersCount: number;
  followingCount: number;
  requestsCount: number;
}

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

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function fetchProfile() {
      try {
        const [profileData, requestsData] = await Promise.all([
          api.get<UserProfile>(`/users/${username}`),
          api.get<RequestsResponse>(`/users/${username}/requests?limit=10`),
        ]);
        setProfile(profileData);
        setRequests(requestsData.data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, [username]);

  const handleFollow = async () => {
    if (!profile || !isAuthenticated || isFollowLoading) return;

    setIsFollowLoading(true);
    try {
      const path = `/follows/users/${profile.id}`;
      const result = isFollowing
        ? await api.delete<{ following: boolean }>(path)
        : await api.put<{ following: boolean }>(path);
      // Only adjust the count if the state actually changed (both calls are idempotent).
      if (result.following !== isFollowing) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followersCount: prev.followersCount + (result.following ? 1 : -1),
              }
            : prev
        );
      }
      setIsFollowing(result.following);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleVoteUpdate = (requestId: string, voted: boolean, voteCount: number) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, hasVoted: voted, voteCount } : r
      )
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-gray-200 rounded-full" />
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">User not found</h1>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.username === profile.username;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-12 h-12 text-primary-600" />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
              {profile.userType === 'DEVELOPER' && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
                  Developer
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-4">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Joined {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
              </span>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="font-semibold text-gray-900">{profile.requestsCount}</span>
                <span className="text-gray-500 ml-1">requests</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{profile.followersCount}</span>
                <span className="text-gray-500 ml-1">followers</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{profile.followingCount}</span>
                <span className="text-gray-500 ml-1">following</span>
              </div>
            </div>
          </div>

          {isAuthenticated && !isOwnProfile && (
            <button
              onClick={handleFollow}
              disabled={isFollowLoading}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                isFollowing
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* User's Requests */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Feature Requests
        </h2>

        {requests.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No feature requests yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onVoteUpdate={handleVoteUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
