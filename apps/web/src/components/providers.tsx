'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { SocketProvider } from '@/components/socket-provider';
import { Toaster } from '@/components/toaster';

export function Providers({ children }: { children: ReactNode }) {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <SocketProvider>
      {children}
      <Toaster />
    </SocketProvider>
  );
}
