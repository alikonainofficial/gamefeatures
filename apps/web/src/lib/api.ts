/**
 * Base URL for REST calls. By default the relative `/api/v1`: next.config.js rewrites it to
 * the API (API_ORIGIN), so the browser sees one origin and the SameSite=Lax refresh cookie
 * keeps working in production. NEXT_PUBLIC_API_URL can still point somewhere else.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/** Error thrown for any non-2xx response. `message` is always a readable string. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * How the client reaches the auth store. Wired once from auth-store.ts (which imports this
 * file), so there is no circular import. The access token lives only in memory; the refresh
 * token is an HTTP-only cookie the browser sends to /auth/refresh.
 */
export interface AuthHooks {
  getAccessToken: () => string | null;
  /** Calls /auth/refresh, stores and returns the new access token. Throws on failure. */
  refresh: () => Promise<string>;
  /** The session is gone (refresh failed): clear the store. */
  onAuthFailure: () => void;
}

/** A 401 from these means bad credentials or an expired session, not a stale access token. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

async function toApiError(response: Response): Promise<ApiError> {
  const body: any = await response.json().catch(() => undefined);
  const raw = body?.message;
  // Nest validation errors arrive as `message: string[]`.
  const message = Array.isArray(raw)
    ? raw.join('; ')
    : typeof raw === 'string' && raw
      ? raw
      : `Request failed (${response.status})`;
  return new ApiError(response.status, message, body);
}

export class ApiClient {
  private auth: AuthHooks | null = null;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  configureAuth(hooks: AuthHooks): void {
    this.auth = hooks;
  }

  /**
   * Refreshes the access token, sharing one in-flight request between all callers. The
   * refresh token rotates on every use, so two parallel refreshes would invalidate each other.
   * Resolves to null when the token can't be refreshed. Only a 401/403 (the session is gone)
   * calls onAuthFailure, once; a 429, 5xx or network error leaves the session in place.
   */
  refreshAccessToken(): Promise<string | null> {
    const auth = this.auth;
    if (!auth) return Promise.resolve(null);

    if (!this.refreshInFlight) {
      this.refreshInFlight = auth
        .refresh()
        .then(
          (token) => {
            if (!token) auth.onAuthFailure();
            return token || null;
          },
          (error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
              auth.onAuthFailure();
            }
            return null;
          },
        )
        .finally(() => {
          this.refreshInFlight = null;
        });
    }
    return this.refreshInFlight;
  }

  private send(method: string, path: string, body: unknown, options: RequestInit, token: string | null) {
    const headers = new Headers(options.headers);
    if (body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: 'include',
      ...options,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    const sentToken = this.auth?.getAccessToken() ?? null;
    const response = await this.send(method, path, body, options, sentToken);

    const mayRefresh =
      response.status === 401 &&
      this.auth !== null &&
      !isRetry &&
      !NO_REFRESH_PATHS.some((p) => path.startsWith(p));

    if (mayRefresh) {
      // Another request may already have refreshed while this one was in flight.
      const current = this.auth!.getAccessToken();
      const token = current && current !== sentToken ? current : await this.refreshAccessToken();
      if (!token) {
        throw await toApiError(response);
      }
      return this.request<T>(method, path, body, options, true);
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body: any, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  patch<T>(path: string, body: any, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  put<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const api = new ApiClient(API_URL);
