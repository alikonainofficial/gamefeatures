/**
 * Retries an assertion until it passes or the timeout expires. Use it for effects that
 * happen asynchronously after a request returns (e.g. BullMQ-driven notifications).
 */
export async function waitFor<T>(
  assertion: () => T | Promise<T>,
  { timeout = 5000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`waitFor timed out after ${timeout}ms`);
}
