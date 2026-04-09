import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { z } from 'zod';

const envSchema = z.object({
  ACCOUNT_ID: z
    .string()
    .min(1, 'ACCOUNT_ID is required')
    .regex(/^0\.0\.\d+$/, 'ACCOUNT_ID must be in format 0.0.12345'),
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required'),
});

/**
 * Creates a Hedera client for testing purposes using environment variables.
 *
 * This function reads operator credentials from environment variables and creates
 * a pre-configured Hedera testnet client. The environment variables should be
 * defined in a `.env.test.local` file.
 *
 * Required environment variables:
 * - ACCOUNT_ID: The operator account ID in format "0.0.12345"
 * - PRIVATE_KEY: The operator private key in DER string format
 *
 * @throws {z.ZodError} When environment variables are missing or invalid
 * @returns {Client} A Hedera testnet client configured with the operator account and private key
 *
 * @example
 * ```typescript
 * // Ensure .env.test.local contains:
 * // ACCOUNT_ID=0.0.12345
 * // PRIVATE_KEY=302e020100300506032b657004220420...
 *
 * const client = getOperatorClientForTests();
 * ```
 */
export const getOperatorClientForTests = (): Client => {
  // Validate environment variables with Zod
  const env = envSchema.parse({
    ACCOUNT_ID: process.env.ACCOUNT_ID,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
  });

  // Initialize Hedera client
  const operatorAccountId = AccountId.fromString(env.ACCOUNT_ID);
  const privateKey = PrivateKey.fromStringDer(env.PRIVATE_KEY); // TODO: handle parsing different key formats

  return Client.forTestnet().setOperator(operatorAccountId, privateKey);
};

/**
 * Creates a custom Hedera testnet client with the provided account credentials.
 *
 * This function allows you to create a Hedera client with specific account
 * credentials rather than reading from environment variables. Useful for
 * testing scenarios that require different operator accounts.
 *
 * @param {AccountId} accountId - The Hedera account ID to use as the operator
 * @param {PrivateKey} privateKey - The private key associated with the account ID
 * @returns {Client} A Hedera testnet client configured with the provided operator account and private key
 *
 * @example
 * ```typescript
 * const accountId = AccountId.fromString("0.0.12345");
 * const privateKey = PrivateKey.fromStringDer("302e020100300506032b657004220420...");
 * const client = getCustomClient(accountId, privateKey);
 * ```
 */
export const getCustomClient = (accountId: AccountId, privateKey: PrivateKey): Client => {
  return Client.forTestnet().setOperator(accountId, privateKey);
};
