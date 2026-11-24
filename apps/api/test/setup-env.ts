import { loadTestEnv } from './utils/load-test-env';

// Runs in each test file before AppModule is imported, so ConfigModule sees the test values.
loadTestEnv();
