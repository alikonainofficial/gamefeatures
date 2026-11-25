'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { DEMO_MODE } from '@/lib/demo';
import { waitForServer } from '@/lib/wake-server';

/**
 * Demo mode only. The free API server sleeps when idle and takes about a minute to wake, so
 * the first visit after a quiet spell would otherwise look broken. This checks /health on load
 * and, if the server is slow or not answering, says so and keeps polling until it's up.
 */
export function DemoBanner() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    if (!DEMO_MODE) return;
    const controller = new AbortController();
    let shown = false;

    waitForServer({
      check: async (signal) => (await fetch(`${API_URL}/health`, { signal })).ok,
      onWaiting: () => {
        shown = true;
        setWaking(true);
      },
      signal: controller.signal,
    }).then((ready) => {
      if (!ready) return;
      setWaking(false);
      // The page's own requests (and the session restore) most likely failed while the server
      // slept, so reload once now that it's up. A reload finds it awake, so this can't loop.
      if (shown) window.location.reload();
    });

    return () => controller.abort();
  }, []);

  if (!waking) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900"
    >
      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
      Waking up the free demo server, this can take up to a minute…
    </div>
  );
}
