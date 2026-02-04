import Link from 'next/link';
import { GameGrid } from '@/components/games/game-grid';
import { SearchBar } from '@/components/search/search-bar';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Shape the Future of Gaming
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Submit feature requests, vote on ideas, and help game developers build what you want.
        </p>
        <SearchBar />
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Popular Games</h2>
          <Link
            href="/games"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View all games →
          </Link>
        </div>
        <GameGrid />
      </section>

      <section className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-8 text-white text-center">
        <h2 className="text-2xl font-bold mb-4">Are you a game developer?</h2>
        <p className="mb-6 text-primary-100">
          Connect with your community and see what features they want most.
        </p>
        <Link
          href="/developers"
          className="inline-block bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition"
        >
          Learn More
        </Link>
      </section>
    </div>
  );
}
