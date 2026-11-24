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
