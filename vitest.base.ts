import { defineConfig } from 'vitest/config';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.test.local') });

/**
 * Shared vitest configuration for all workspace packages.
 * Import and merge in each package's vitest.config.ts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      enabled: false,
    },
    testTimeout: 120000,
    hookTimeout: 120000,
    retry: 3,
    // CI-class runners default to ~3 workers (one per vCPU minus one), which leaves
    // Solo idle most of the time — our tests are network-bound on the agent's LLM
    // round-trips and Hedera consensus, not CPU-bound. Bumping to 6 lets vitest
    // schedule more files in flight; Solo's single consensus node serializes the
    // actual transactions but the LLM/mirror waits overlap cleanly across workers.
    maxWorkers: 6,
  },
});
