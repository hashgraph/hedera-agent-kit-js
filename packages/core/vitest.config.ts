import { defineConfig, mergeConfig } from 'vitest/config';
import * as path from 'node:path';
import baseConfig from '../../vitest.base';

/**
 * Base vitest config for the core package. Used by `pnpm test:unit` directly.
 * Integration tests extend this via `vitest.integration.config.ts` to add the
 * TestProfile setup hooks (which require live Hedera credentials in env).
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@/': path.resolve(__dirname, 'src') + '/',
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['node_modules/**', 'dist/**'],
    },
  }),
);
