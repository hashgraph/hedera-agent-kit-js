import { defineConfig, mergeConfig } from 'vitest/config';
import * as path from 'node:path';
import baseConfig from './vitest.config';

/**
 * Integration / e2e vitest config - extends the base with TestProfile setup hooks.
 * Splitting this from `vitest.config.ts` keeps unit tests free of network-credential
 * requirements (the profile's zod schema strictly requires HEDERA_ACCOUNT_ID and
 * HEDERA_PRIVATE_KEY at resolution time).
 */
const sharedSetup = path.resolve(__dirname, '../tests/shared/setup');

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      globalSetup: [path.resolve(sharedSetup, 'global-setup.ts')],
      setupFiles: [path.resolve(sharedSetup, 'usd-to-hbar-setup.ts')],
    },
  }),
);
