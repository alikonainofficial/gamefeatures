import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, Users } from 'lucide-react';

interface GameCardProps {
  game: {
    id: string;
    slug: string;
    name: string;
    coverImageUrl: string | null;
    platforms: string[];
    genres: string[];
    requestsCount: number;
    followersCount: number;
  };
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition"
    >
      <div className="relative aspect-[16/9] bg-gray-100">
        {game.coverImageUrl ? (
          <Image
            src={game.coverImageUrl}
            alt={game.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
          {game.name}
        </h3>
        <div className="flex flex-wrap gap-1 mt-2">
          {game.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
            >
              {genre}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {game.requestsCount}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {game.followersCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
