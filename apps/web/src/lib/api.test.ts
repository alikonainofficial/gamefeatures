import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, AuthHooks } from './api';

const BASE = 'http://api.test/api/v1';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const authHeader = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

/** A client whose fetch accepts only `Bearer <validToken>` and whose refresh is controllable. */
function setup(opts: { refresh?: () => Promise<string>; validToken?: string } = {}) {
  let token: string | null = 'stale';
  const validToken = opts.validToken ?? 'fresh';

  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    authHeader(init) === `Bearer ${validToken}`
      ? json(200, { ok: true })
      : json(401, { statusCode: 401, message: 'Unauthorized' }),
  );

  const hooks: AuthHooks = {
    getAccessToken: () => token,
    refresh: vi.fn(
      opts.refresh ??
        (async () => {
          await new Promise((r) => setTimeout(r, 10)); // still in flight when the other 401s land
          token = 'fresh';
          return token;
        }),
    ),
    onAuthFailure: vi.fn(() => {
      token = null;
    }),
  };

  const client = new ApiClient(BASE, fetchMock as unknown as typeof fetch);
  client.configureAuth(hooks);
  return {
    client,
    hooks,
    fetchMock,
    setToken: (t: string | null) => {
      token = t;
    },
  };
}

describe('ApiClient', () => {
  it('attaches the in-memory access token and keeps caller headers', async () => {
    const { client, fetchMock, setToken } = setup();
    setToken('fresh');

    await client.post('/requests', { title: 'x' }, { headers: { 'X-Trace': 'abc' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/requests`);
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer fresh');
    expect(headers.get('X-Trace')).toBe('abc');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe(JSON.stringify({ title: 'x' }));
  });

  it("a caller's headers can't remove the Authorization header", async () => {
    const { client, fetchMock, setToken } = setup();
    setToken('fresh');
    await client.get('/me', { headers: { Authorization: 'Bearer forged' } });
    expect(authHeader(fetchMock.mock.calls[0][1])).toBe('Bearer fresh');
  });

  it('3 concurrent 401s trigger exactly one refresh, then 3 retries with the new token', async () => {
    const { client, hooks, fetchMock } = setup();

    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const retries = fetchMock.mock.calls.slice(3).map(([, init]) => authHeader(init));
    expect(retries).toEqual(['Bearer fresh', 'Bearer fresh', 'Bearer fresh']);
  });

  it('a failed refresh calls onAuthFailure once and every caller gets the 401', async () => {
    const { client, hooks } = setup({
      refresh: async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw new ApiError(401, 'Invalid refresh token');
      },
    });

    const results = await Promise.allSettled([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(hooks.onAuthFailure).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toMatchObject({ name: 'ApiError', status: 401 });
    }
  });

  it('a rate-limited (429) refresh does not end the session', async () => {
    const { client, hooks } = setup({
      refresh: async () => {
        throw new ApiError(429, 'Too Many Requests');
      },
    });

    await expect(client.get('/a')).rejects.toMatchObject({ status: 401 });
    expect(hooks.onAuthFailure).not.toHaveBeenCalled();
  });

  it.each(['/auth/login', '/auth/register', '/auth/refresh'])(
    'a 401 from %s never triggers a refresh',
    async (path) => {
      const { client, hooks, fetchMock } = setup();
      fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, message: 'Invalid credentials' }));

      await expect(client.post(path, {})).rejects.toMatchObject({
        status: 401,
        message: 'Invalid credentials',
      });
      expect(hooks.refresh).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('retries once with a token that changed while the request was in flight, without refreshing', async () => {
    const { client, hooks, fetchMock, setToken } = setup();
    fetchMock.mockImplementationOnce(async () => {
      setToken('fresh'); // another request refreshed meanwhile
      return json(401, { message: 'Unauthorized' });
    });

    await expect(client.get('/a')).resolves.toEqual({ ok: true });
    expect(hooks.refresh).not.toHaveBeenCalled();
    expect(authHeader(fetchMock.mock.calls[1][1])).toBe('Bearer fresh');
  });

  it('only retries once: a second 401 after refreshing is returned to the caller', async () => {
    const { client, hooks } = setup({ validToken: 'never-valid' });
    await expect(client.get('/a')).rejects.toMatchObject({ status: 401 });
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
  });

  describe('ApiError', () => {
    it('joins Nest validation message arrays', async () => {
      const client = new ApiClient(BASE, (async () =>
        json(400, { statusCode: 400, message: ['title must be longer', 'gameId must be a string'] })) as typeof fetch);
      await expect(client.post('/requests', {})).rejects.toMatchObject({
        name: 'ApiError',
        status: 400,
        message: 'title must be longer; gameId must be a string',
      });
    });

    it('keeps a string message and the response body', async () => {
      const body = { statusCode: 409, message: 'Username already taken', fields: ['username'] };
      const client = new ApiClient(BASE, (async () => json(409, body)) as typeof fetch);
      const error = (await client.patch('/users/me', {}).catch((e) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Username already taken');
      expect(error.body).toEqual(body);
    });

    it('falls back to a generic message when the body is not JSON', async () => {
      const client = new ApiClient(BASE, (async () => new Response('oops', { status: 502 })) as typeof fetch);
      await expect(client.get('/games')).rejects.toMatchObject({
        status: 502,
        message: 'Request failed (502)',
      });
    });
  });

  it('returns {} for 204 responses', async () => {
    const client = new ApiClient(BASE, (async () => new Response(null, { status: 204 })) as typeof fetch);
    await expect(client.delete('/requests/1/vote')).resolves.toEqual({});
  });

  it('without auth configured, a 401 is simply thrown', async () => {
    const client = new ApiClient(BASE, (async () => json(401, { message: 'Unauthorized' })) as typeof fetch);
    await expect(client.get('/me')).rejects.toMatchObject({ status: 401 });
  });
});
