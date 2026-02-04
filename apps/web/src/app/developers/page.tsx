import Link from 'next/link';
import { CheckCircle, Users, TrendingUp, MessageSquare } from 'lucide-react';

export default function DevelopersPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            For Game Developers
          </h1>
          <p className="text-xl text-gray-600">
            Connect directly with your community. Understand what features they want most.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Direct Community Feedback
            </h3>
            <p className="text-gray-600">
              See exactly what features your players want. No more guessing or relying on scattered forum posts.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Prioritize with Confidence
            </h3>
            <p className="text-gray-600">
              Vote-based ranking shows you which features matter most. Make data-driven development decisions.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Communicate Progress
            </h3>
            <p className="text-gray-600">
              Update request statuses and respond to your community. Build trust by showing you listen.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Verified Developer Badge
            </h3>
            <p className="text-gray-600">
              Get verified status for your game. Your responses will be highlighted and trusted by players.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to connect with your players?</h2>
          <p className="mb-6 text-primary-100">
            Contact us to get verified developer access for your game.
          </p>
          <a
            href="mailto:developers@gamereview.com"
            className="inline-block bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition"
          >
            Contact Us
          </a>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            How It Works
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Get Verified</h3>
                <p className="text-gray-600">
                  Contact us to verify your developer status. We'll confirm your identity and grant access to your game's page.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Review Requests</h3>
                <p className="text-gray-600">
                  Browse feature requests from your community. See vote counts and discussions to understand priorities.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Update Status</h3>
                <p className="text-gray-600">
                  Mark requests as "Under Review", "In Progress", or "Implemented". Add your response to let players know you're listening.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Build Trust</h3>
                <p className="text-gray-600">
                  Players get notified when you respond. Transparent communication builds a loyal community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
