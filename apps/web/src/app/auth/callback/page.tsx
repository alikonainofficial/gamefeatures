'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken, setUser } = useAuthStore();

  useEffect(() => {
    async function handleCallback() {
      const token = searchParams.get('token');

      if (token) {
        setAccessToken(token);

        try {
          const user = await api.get<any>('/auth/me');
          setUser(user);
          router.push('/');
        } catch (error) {
          console.error('Failed to fetch user:', error);
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    }

    handleCallback();
  }, [searchParams, setAccessToken, setUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
