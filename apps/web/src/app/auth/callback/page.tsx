'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';

/** Reads `token` from a URL fragment like `#token=abc`. */
function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token');
}

/**
 * OAuth lands here with the access token in the URL fragment (never sent to any server).
 * It is read once, removed from the address bar and history, and kept only in memory.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { setAccessToken, setUser } = useAuthStore();

  useEffect(() => {
    const token = tokenFromHash(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname);

    async function handleCallback() {
      if (!token) {
        router.replace('/login');
        return;
      }

      setAccessToken(token);
      try {
        const user = await api.get<any>('/auth/me');
        setUser(user);
        router.replace('/');
      } catch (error) {
        console.error('Failed to fetch user:', error);
        router.replace('/login');
      }
    }

    handleCallback();
  }, [setAccessToken, setUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
