'use client';

import Link from 'next/link';
import { Heart, Reply, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface CommentItemProps {
  comment: Comment;
  onLike: (commentId: string) => void;
  onReply: (commentId: string) => void;
  isAuthenticated: boolean;
  depth?: number;
}

const MAX_DEPTH = 5;

export function CommentItem({
  comment,
  onLike,
  onReply,
  isAuthenticated,
  depth = 0,
}: CommentItemProps) {
  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {comment.author.avatarUrl ? (
            <img
              src={comment.author.avatarUrl}
              alt={comment.author.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/users/${comment.author.username}`}
              className="font-medium text-gray-900 hover:underline"
            >
              {comment.author.username}
            </Link>
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>

          <p className="text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => onLike(comment.id)}
              disabled={!isAuthenticated}
              className={`flex items-center gap-1 text-sm transition ${
                comment.hasLiked
                  ? 'text-red-500'
                  : 'text-gray-500 hover:text-red-500'
              } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Heart
                className={`w-4 h-4 ${comment.hasLiked ? 'fill-current' : ''}`}
              />
              {comment.likeCount}
            </button>

            {isAuthenticated && depth < MAX_DEPTH && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onLike={onLike}
              onReply={onReply}
              isAuthenticated={isAuthenticated}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
