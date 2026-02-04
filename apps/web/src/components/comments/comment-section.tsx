'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CommentItem } from './comment-item';
import { Send } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  likeCount: number;
  hasLiked: boolean;
  createdAt: string;
  parentId: string | null;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  replies: Comment[];
}

interface CommentSectionProps {
  requestId: string;
}

export function CommentSection({ requestId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchComments();
  }, [requestId]);

  const fetchComments = async () => {
    try {
      const data = await api.get<Comment[]>(`/requests/${requestId}/comments`);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.post(`/requests/${requestId}/comments`, {
        content: newComment,
        parentId: replyingTo,
      });
      setNewComment('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(
        `/comments/${commentId}/like`,
        {}
      );
      updateCommentLike(comments, commentId, result.liked, result.likeCount);
      setComments([...comments]);
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };

  const updateCommentLike = (
    commentList: Comment[],
    commentId: string,
    liked: boolean,
    likeCount: number
  ): boolean => {
    for (const comment of commentList) {
      if (comment.id === commentId) {
        comment.hasLiked = liked;
        comment.likeCount = likeCount;
        return true;
      }
      if (comment.replies.length > 0) {
        if (updateCommentLike(comment.replies, commentId, liked, likeCount)) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Comments ({comments.reduce((acc, c) => acc + 1 + c.replies.length, 0)})
      </h2>

      {/* Comment Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mb-6">
          {replyingTo && (
            <div className="mb-2 text-sm text-gray-500 flex items-center justify-between">
              <span>Replying to comment</span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-primary-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="self-end px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center text-gray-600">
          <a href="/login" className="text-primary-600 hover:underline">
            Sign in
          </a>{' '}
          to leave a comment
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={handleLike}
              onReply={(id) => setReplyingTo(id)}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
