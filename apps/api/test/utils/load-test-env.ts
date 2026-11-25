import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Loads test/.env.test into process.env without overriding variables that are already set,
 * so CI (or a developer) can point the tests somewhere else.
 */
export function loadTestEnv(): void {
  const file = readFileSync(join(__dirname, '..', '.env.test'), 'utf8');
  for (const line of file.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Refuse to migrate or truncate anything that isn't clearly a test database. Both URLs are
 * checked: the app and reset.ts use DATABASE_URL, and `prisma migrate deploy` uses DIRECT_URL.
 */
export function assertTestDatabase(): void {
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = process.env[key] ?? '';
    const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '(unset)';
    if (!dbName.endsWith('_test')) {
      throw new Error(
        `Refusing to run e2e tests with ${key} pointing at "${dbName}": the database name must end in "_test".`,
      );
    }
  }
}
