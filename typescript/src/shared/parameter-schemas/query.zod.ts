import { z } from 'zod';
import { Context } from '@/shared/configuration';

// add a description to the parameters
export const accountQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().describe('The account ID to query.'),
  });

//add a description to the parameters
export const accountBalanceQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().optional().describe('The account ID to query.'),
  });

//add a description to the parameters
export const accountTokenBalancesQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z
      .string()
      .optional()
      .describe('The account ID to query. If not provided, this accountId will be used.'),
    tokenId: z.string().optional().describe('The token ID to query.'),
  });

export const tokenInfoQueryParameters = (_context:Context = {}) =>
  z.object({
    tokenId: z.string().optional().describe('The token ID to query.'),
  })

export const topicMessagesQueryParameters = (_context: Context = {}) =>
  z.object({
    topicId: z.string().describe('The topic ID to query.'),
    startTime: z
      .string()
      .datetime()
      .optional()
      .describe(
        'The start time to query. If set, the messages will be returned after this timestamp.',
      ),
    endTime: z
      .string()
      .datetime()
      .optional()
      .describe(
        'The end time to query. If set, the messages will be returned before this timestamp.',
      ),
    limit: z
      .number()
      .optional()
      .describe('The limit of messages to query. If set, the number of messages to return.'),
  });

export const transactionDetailsQueryParameters = (_context: Context = {}) => {
  return z.object({
    transactionId: z.string().describe('The transaction ID to fetch details for. Should be in format \\"shard.realm.num-sss-nnn\\" format where sss are seconds and nnn are nanoseconds'),
    nonce: z.number().optional().describe('Optional nonce value for the transaction'),
  });
};
