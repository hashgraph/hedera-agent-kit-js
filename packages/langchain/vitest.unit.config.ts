import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base';

/** Unit tests: no network profile / global setup required. */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/unit/**/*.test.ts'],
      exclude: ['node_modules/**', 'dist/**'],
      retry: 0,
    },
  }),
);
