import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.base';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
}));
