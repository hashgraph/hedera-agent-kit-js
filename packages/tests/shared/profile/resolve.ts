import { AccountId, LedgerId, PrivateKey } from '@hiero-ledger/sdk';
import { z } from 'zod';
import type { TestProfile } from './index';
import { createSoloProfile } from './solo-profile';
import { createTestnetProfile } from './testnet-profile';

const networkSchema = z.enum(['testnet', 'local-node']).default('testnet');

export type TestNetwork = z.infer<typeof networkSchema>;

const envSchema = z.object({
  HEDERA_NETWORK: networkSchema,
  HEDERA_ACCOUNT_ID: z
    .string()
    .min(1, 'HEDERA_ACCOUNT_ID is required')
    .regex(/^0\.0\.\d+$/, 'HEDERA_ACCOUNT_ID must be in format 0.0.12345'),
  HEDERA_PRIVATE_KEY: z.string().min(1, 'HEDERA_PRIVATE_KEY is required'),
});

/**
 * Reads HEDERA_NETWORK from env and returns the matching enum value.
 * Defaults to 'testnet' when unset. Use sparingly. Most callers should use
 * `getProfile()` instead of branching on the network themselves.
 */
export const getTestNetwork = (): TestNetwork =>
  networkSchema.parse(process.env.HEDERA_NETWORK);

/** Maps the active network to the SDK's LedgerId. */
export const getTestLedgerIdForTests = (): LedgerId =>
  getTestNetwork() === 'local-node' ? LedgerId.LOCAL_NODE : LedgerId.TESTNET;

let cached: TestProfile | null = null;

/**
 * Returns the active test profile. Lazy: resolves on first call, caches for the session.
 */
export const getProfile = (): TestProfile => {
  if (cached !== null) return cached;
  const env = envSchema.parse({
    HEDERA_NETWORK: process.env.HEDERA_NETWORK,
    HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID,
    HEDERA_PRIVATE_KEY: process.env.HEDERA_PRIVATE_KEY,
  });
  const operator = {
    accountId: AccountId.fromString(env.HEDERA_ACCOUNT_ID),
    privateKey: PrivateKey.fromStringECDSA(env.HEDERA_PRIVATE_KEY),
  };
  cached = env.HEDERA_NETWORK === 'local-node'
    ? createSoloProfile(operator)
    : createTestnetProfile(operator);
  return cached;
};

/** Test-only: clears the cached profile so a subsequent `getProfile()` re-resolves. */
export const __resetProfileForTesting = (): void => {
  cached = null;
};
