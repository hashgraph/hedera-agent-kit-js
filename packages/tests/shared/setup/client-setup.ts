import { AccountId, Client, LedgerId, PrivateKey } from '@hiero-ledger/sdk';
import { z } from 'zod';
import {
  CONSENSUS_NODE_ACCOUNT_ID,
  CONSENSUS_NODE_ENDPOINT,
  MIRROR_NODE_ENDPOINT,
} from './constants';

const hederaNetworkSchema = z.enum(['testnet', 'local-node']).default('testnet');

const coreEnvSchema = z.object({
  HEDERA_NETWORK: hederaNetworkSchema,
  HEDERA_ACCOUNT_ID: z
    .string()
    .min(1, 'HEDERA_ACCOUNT_ID is required')
    .regex(/^0\.0\.\d+$/, 'HEDERA_ACCOUNT_ID must be in format 0.0.12345'),
  HEDERA_PRIVATE_KEY: z.string().min(1, 'HEDERA_PRIVATE_KEY is required'),
});

export type HederaTestNetwork = z.infer<typeof hederaNetworkSchema>;

export const getTestNetwork = (): HederaTestNetwork => {
  return hederaNetworkSchema.parse(process.env.HEDERA_NETWORK);
};

export const getTestLedgerIdForTests = (): LedgerId => {
  return getTestNetwork() === 'local-node' ? LedgerId.LOCAL_NODE : LedgerId.TESTNET;
};

const createClientForSelectedNetwork = (accountId: AccountId, privateKey: PrivateKey): Client => {
  if (getTestNetwork() === 'testnet') {
    return Client.forTestnet().setOperator(accountId, privateKey);
  }

  const client = Client.forNetwork({
    [CONSENSUS_NODE_ENDPOINT]: AccountId.fromString(CONSENSUS_NODE_ACCOUNT_ID),
  });
  client.setLedgerId(LedgerId.LOCAL_NODE);
  client.setMirrorNetwork(MIRROR_NODE_ENDPOINT);
  return client.setOperator(accountId, privateKey);
};

/**
 * Creates a Hedera client for testing purposes using environment variables.
 *
 * Reads operator credentials from env and returns a pre-configured Hedera client.
 * Solo service endpoints (consensus node, mirror node gRPC, etc.) are static
 * constants in `constants.ts` — not env-configurable. If Solo's port-forward
 * defaults ever change, update the constants file.
 *
 * Required environment variables:
 * - HEDERA_NETWORK: "local-node" (Solo) or "testnet"
 * - HEDERA_ACCOUNT_ID: Operator account ID in format "0.0.12345"
 * - HEDERA_PRIVATE_KEY: Operator private key in DER string format
 *
 * @throws {z.ZodError} When environment variables are missing or invalid
 */
export const getOperatorClientForTests = (): Client => {
  const env = coreEnvSchema.parse({
    HEDERA_NETWORK: process.env.HEDERA_NETWORK,
    HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID,
    HEDERA_PRIVATE_KEY: process.env.HEDERA_PRIVATE_KEY,
  });

  const operatorAccountId = AccountId.fromString(env.HEDERA_ACCOUNT_ID);
  const privateKey = PrivateKey.fromStringECDSA(env.HEDERA_PRIVATE_KEY); // TODO: handle parsing different key formats

  return createClientForSelectedNetwork(operatorAccountId, privateKey);
};

/**
 * Creates a custom Hedera client with the provided account credentials.
 * Useful for test scenarios that require different operator accounts than the one in env.
 */
export const getCustomClient = (accountId: AccountId, privateKey: PrivateKey): Client => {
  return createClientForSelectedNetwork(accountId, privateKey);
};
