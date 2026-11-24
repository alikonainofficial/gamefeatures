import { ThrottlerModuleOptions } from '@nestjs/throttler';

/** Parses a positive integer from config, falling back on missing or invalid values. */
export function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Default limit for every route: THROTTLE_LIMIT requests per THROTTLE_TTL_MS per client IP. */
export function defaultThrottlers(config: {
  get: (key: string) => unknown;
}): ThrottlerModuleOptions {
  return [
    {
      ttl: positiveInt(config.get('THROTTLE_TTL_MS'), 60_000),
      limit: positiveInt(config.get('THROTTLE_LIMIT'), 100),
    },
  ];
}

/**
 * Stricter limit for login, register and refresh (credential guessing). Resolved per request
 * from the environment (ConfigModule loads .env into process.env), so it is configurable.
 */
export const AUTH_THROTTLE = {
  default: {
    limit: () => positiveInt(process.env.AUTH_THROTTLE_LIMIT, 10),
    ttl: () => positiveInt(process.env.AUTH_THROTTLE_TTL_MS, 60_000),
  },
};

/**
 * Tracks a request by the user in its bearer token, falling back to the IP.
 *
 * Throttling runs as a global guard, before JwtAuthGuard has verified the token, so the token
 * is only decoded here. That is safe for counting: JwtAuthGuard still rejects a forged token
 * right after, and only a valid token (with its genuine `sub`) can reach the handler.
 */
export function userOrIpTracker(req: Record<string, any>): string {
  const auth: unknown = req.headers?.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (typeof payload?.sub === 'string') return `user:${payload.sub}`;
    } catch {
      // Not a JWT: fall back to the IP.
    }
  }
  return `ip:${req.ip}`;
}

/** RAWG imports: 10 per hour per user (F16). */
export const IMPORT_THROTTLE = {
  default: { limit: 10, ttl: 60 * 60 * 1000, getTracker: userOrIpTracker },
};
