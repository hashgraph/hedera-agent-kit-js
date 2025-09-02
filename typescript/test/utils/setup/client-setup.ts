import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { z } from 'zod';

const envSchema = z.object({
  ACCOUNT_ID: z
    .string()
    .min(1, 'ACCOUNT_ID is required')
    .regex(/^0\.0\.\d+$/, 'ACCOUNT_ID must be in format 0.0.12345'),
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required'),
});

export const getClientForTests = (): Client => {
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
