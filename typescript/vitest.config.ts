import { defineConfig } from 'vitest/config';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.test.local') });

// Build setupFiles conditionally. We only enable the slowdown setup when
// SLOW_TEST_DELAY_MS is defined, so unit tests are not affected.
const setupFiles: string[] = [];
if (process.env.SLOW_TEST_DELAY_MS !== undefined) {
  setupFiles.push(path.resolve(__dirname, 'test/utils/setup/slowdown.ts'));
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'hedera-agent-kit': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'examples/**',
      'src/**/types.ts',
      'src/**/index.ts',
      'src/**/*.d.ts',
    ],
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      reporter: ['text', 'html'],
      enabled: false,
    },
    setupFiles,
    testTimeout: 120000,
    hookTimeout: 120000,
    // Retry configuration for e2e tests
    retry: 3, // Only retry in CI/production, not during development
  },
});
