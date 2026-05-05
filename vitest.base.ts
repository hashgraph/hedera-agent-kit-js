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
  },
});
