import { defineConfig, mergeConfig } from 'vitest/config';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import baseConfig from '../../vitest.base';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const sharedSetup = path.resolve(__dirname, '../tests/shared/setup');

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
      setupFiles: [path.resolve(sharedSetup, 'usd-to-hbar-setup.ts')],
    },
  }),
);
