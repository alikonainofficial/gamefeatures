import { GatewayTimeoutException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawgAdapter } from './rawg.adapter';

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

/** A fetch that never answers until the request is aborted, like a hung upstream. */
function hangingFetch() {
  return jest.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      }),
  );
}

describe('RawgAdapter', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it.each([
    ['getGameById', (a: RawgAdapter) => a.getGameById('3498')],
    ['searchGames', (a: RawgAdapter) => a.searchGames('portal')],
    ['getPopularGames', (a: RawgAdapter) => a.getPopularGames()],
  ])('%s gives up after RAWG_TIMEOUT_MS with a 504', async (_, call) => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const adapter = new RawgAdapter(config({ RAWG_TIMEOUT_MS: '50' }));

    const started = Date.now();
    const error = await call(adapter).catch((e) => e);

    expect(error).toBeInstanceOf(GatewayTimeoutException);
    expect((error as HttpException).getStatus()).toBe(504);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('defaults to a 5 second timeout and passes an abort signal to fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, name: 'Portal' }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await new RawgAdapter(config({})).getGameById('1');

    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    timeoutSpy.mockRestore();
  });

  it('still maps other network failures to 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    const error = await new RawgAdapter(config({})).searchGames('x').catch((e) => e);
    expect((error as HttpException).getStatus()).toBe(502);
  });
});
