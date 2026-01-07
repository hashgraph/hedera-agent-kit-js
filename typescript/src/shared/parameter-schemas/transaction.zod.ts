import { Context } from '@/shared';
import { z } from 'zod';

export const transactionRecordQueryParameters = (_context: Context = {}) => {
  return z.object({
    transactionId: z
      .string()
      .describe(
        'The transaction ID to fetch details for. Should be in format \\"shard.realm.num-sss-nnn\\" format where sss are seconds and nnn are nanoseconds',
      ),
    nonce: z
      .number()
      .nonnegative()
      .optional()
      .describe('Optional nonnegative nonce value for the transaction'),
  });
};

export const normalisedTransactionRecordQueryParameters = (_context: Context = {}) =>
  transactionRecordQueryParameters(_context).extend({});
