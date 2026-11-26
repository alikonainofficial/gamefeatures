import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForServer } from './wake-server';

/** A check that answers after `ms` with `ok`, or never answers (until aborted) when ms is null. */
const answersAfter = (ms: number | null, ok = true) =>
  vi.fn(
    (signal: AbortSignal) =>
      new Promise<boolean>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
        if (ms !== null) setTimeout(() => resolve(ok), ms);
      }),
  );

describe('waitForServer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves without showing the banner when the server answers within 2 s', async () => {
    const onWaiting = vi.fn();
    const result = waitForServer({ check: answersAfter(500), onWaiting });

    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it('shows the banner once the first answer takes longer than 2 s', async () => {
    const onWaiting = vi.fn();
    const result = waitForServer({ check: answersAfter(3000), onWaiting });

    await vi.advanceTimersByTimeAsync(1999);
    expect(onWaiting).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onWaiting).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe(true);
    expect(onWaiting).toHaveBeenCalledTimes(1);
  });

  it('gives each attempt 8 s, then retries every 5 s until the server answers', async () => {
    const onWaiting = vi.fn();
    let calls = 0;
    // Attempts 1 and 2 hang (cold start), attempt 3 answers at once.
    const check = vi.fn((signal: AbortSignal) => {
      calls++;
      return calls < 3 ? answersAfter(null)(signal) : Promise.resolve(true);
    });
    const result = waitForServer({ check, onWaiting });

    await vi.advanceTimersByTimeAsync(8000); // attempt 1 times out
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000); // retry delay
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000 + 5000); // attempt 2 times out, retry delay
    expect(check).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toBe(true);
    expect(onWaiting).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0][0].aborted).toBe(true); // the timed-out attempt was cancelled
  });

  it('treats a failed answer (e.g. a 502 from the proxy) as not ready: banner, then retry', async () => {
    const onWaiting = vi.fn();
    const check = vi
      .fn<(signal: AbortSignal) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(true);
    const result = waitForServer({ check, onWaiting });

    await vi.advanceTimersByTimeAsync(0);
    expect(onWaiting).toHaveBeenCalledTimes(1); // shown at once, not after 2 s
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('stops (resolving false) when its signal is aborted, e.g. on unmount', async () => {
    const controller = new AbortController();
    const check = vi.fn<(signal: AbortSignal) => Promise<boolean>>().mockResolvedValue(false);
    const result = waitForServer({ check, onWaiting: vi.fn(), signal: controller.signal });

    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toBe(false);
    const callsAtAbort = check.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(check).toHaveBeenCalledTimes(callsAtAbort);
  });
});
