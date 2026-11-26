export interface WaitForServerOptions {
  /** One health request. Resolves true when the server is ready; must honour `signal`. */
  check: (signal: AbortSignal) => Promise<boolean>;
  /** Called once, when the server is evidently asleep (slow or failing): show the banner. */
  onWaiting: () => void;
  /** Stops waiting (e.g. on unmount); the promise then resolves false. */
  signal?: AbortSignal;
  /** Show the banner if the first answer takes longer than this. */
  slowAfterMs?: number;
  /** Give up on a single health request after this long. */
  attemptTimeoutMs?: number;
  /** Pause between failed attempts. */
  retryEveryMs?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}

/**
 * Waits for a free-tier API that may be asleep (Render spins it down after 15 idle minutes and
 * takes about a minute to wake). Resolves true once a health check succeeds. A slow first
 * answer or any failed attempt (timeout, network error, 502/503 from the proxy) counts as
 * "waking up": onWaiting() fires once and the check is retried until it succeeds.
 */
export async function waitForServer({
  check,
  onWaiting,
  signal,
  slowAfterMs = 2000,
  attemptTimeoutMs = 8000,
  retryEveryMs = 5000,
}: WaitForServerOptions): Promise<boolean> {
  let waiting = false;
  const markWaiting = () => {
    if (!waiting && !signal?.aborted) {
      waiting = true;
      onWaiting();
    }
  };
  const slowTimer = setTimeout(markWaiting, slowAfterMs);

  const attempt = async (): Promise<boolean> => {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      return await check(controller.signal);
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  try {
    while (!signal?.aborted) {
      if (await attempt()) return true;
      if (signal?.aborted) break;
      markWaiting();
      await sleep(retryEveryMs, signal);
    }
    return false;
  } finally {
    clearTimeout(slowTimer);
  }
}
