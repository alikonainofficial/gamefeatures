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

/** Refuse to truncate anything that isn't clearly a test database. */
export function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${dbName}": the database name must end in "_test".`,
    );
  }
}
