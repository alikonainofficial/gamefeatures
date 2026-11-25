export const DEFAULT_WEB_URL = 'http://localhost:3000';

/**
 * Parses WEB_URL, which may be a comma-separated list of web app origins (for example the
 * deployed site and http://localhost:3000). Used for HTTP and Socket.IO CORS.
 */
export function webOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : [DEFAULT_WEB_URL];
}

/** The main web app URL (the first WEB_URL entry): where OAuth sends the browser back to. */
export function primaryWebUrl(value: string | undefined): string {
  return webOrigins(value)[0];
}
