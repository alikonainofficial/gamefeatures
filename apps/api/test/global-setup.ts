import { execSync } from 'child_process';
import { join } from 'path';
import { assertTestDatabase, loadTestEnv } from './utils/load-test-env';

/**
 * Brings the test database up to the latest migration once per run.
 * `prisma migrate deploy` creates the database if it doesn't exist yet.
 */
export default async function globalSetup(): Promise<void> {
  loadTestEnv();
  assertTestDatabase();

  execSync('pnpm --filter @game-review/database exec prisma migrate deploy', {
    cwd: join(__dirname, '..', '..', '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
