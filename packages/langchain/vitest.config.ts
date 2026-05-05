import { defineConfig, mergeConfig } from 'vitest/config';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import baseConfig from '../../vitest.base';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sharedSetup = path.resolve(__dirname, '../tests/shared/setup');
const setupFiles: string[] = [path.resolve(sharedSetup, 'usd-to-hbar-setup.ts')];
if (process.env.SLOW_TEST_DELAY_MS !== undefined) {
  setupFiles.push(path.resolve(sharedSetup, 'slowdown.ts'));
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@tests/': path.resolve(__dirname, 'tests') + '/',
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['node_modules/**', 'dist/**'],
      globalSetup: [path.resolve(sharedSetup, 'global-setup.ts')],
      setupFiles,
    },
  }),
);
