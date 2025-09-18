import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { AccountId, PublicKey, TokenId } from '@hashgraph/sdk';

export const createTopicParameters = (_context: Context = {}) => {
  return z.object({
    isSubmitKey: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to set a submit key for the topic (optional)'),
    topicMemo: z.string().optional().describe('Memo for the topic (optional)'),
  });
};

export const createTopicParametersNormalised = (_context: Context = {}) =>
  createTopicParameters(_context).extend({
    autoRenewAccountId: z
      .string()
      .describe(
        'The auto renew account for the topic. If not provided, defaults to the operator account.',
      ),
    submitKey: z.custom<PublicKey>().optional().describe('The submit key of topic'),
    adminKey: z.custom<PublicKey>().optional().describe('The admin key of topic'),
  });

export const submitTopicMessageParameters = (_context: Context = {}) => {
  return z.object({
    topicId: z.string().describe('The ID of the topic to submit the message to'),
    message: z.string().describe('The message to submit to the topic'),
  });
};

export const submitTopicMessageParametersNormalised = (_context: Context = {}) =>
  submitTopicMessageParameters(_context).extend({}); // currently no additional fields are needed

export const deleteTopicParameters = (_context: Context = {}) =>
  z.object({
    topicId: z.string().describe('The ID of the topic to delete.'),
  });

export const deleteTopicParametersNormalised = (_context: Context = {}) =>
  deleteTopicParameters(_context).extend({});

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

export const updateTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().describe('The ID of the token to update (e.g., 0.0.12345).'),
    tokenDesc: z
      .string()
      .optional()
      .describe('Optional description of the token update operation.'),
    tokenName: z
      .string()
      .max(100)
      .optional()
      .describe('New name for the token. Up to 100 characters.'),
    tokenSymbol: z
      .string()
      .max(100)
      .optional()
      .describe('New symbol for the token. Up to 100 characters.'),
    treasuryAccountId: z
      .string()
      .optional()
      .describe('New treasury account for the token (Hedera account ID).'),
    adminKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New admin key. Pass boolean `true` to use the operator/user key, or provide a Hedera-compatible public key string. Required for most property updates.',
      ),
    kycKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New KYC key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    freezeKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New freeze key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    wipeKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New wipe key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    supplyKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New supply key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    feeScheduleKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New fee schedule key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    pauseKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New pause key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    metadataKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New metadata key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    metadata: z
      .string()
      .optional()
      .describe('New metadata for the token, in bytes (as base64 or hex).'),
    tokenMemo: z
      .string()
      .max(100)
      .optional()
      .describe('Short public memo for the token, up to 100 characters.'),
    expirationTime: z
      .string()
      .optional()
      .describe('New expiry for the token in ISO 8601 format (e.g., 2025-12-31T23:59:59Z).'),
    autoRenewAccountId: z
      .string()
      .optional()
      .describe('Account to automatically pay for token renewal (Hedera account ID).'),
    autoRenewPeriod: z.number().optional().describe('Auto-renew interval in seconds.'),
  });

export const updateTokenParametersNormalised = (_context: Context = {}) =>
  z.object({
    tokenId: z.instanceof(TokenId),

    // Strings
    tokenName: z.string().optional(),
    tokenSymbol: z.string().optional(),
    tokenMemo: z.string().optional(),
    metadata: z.instanceof(Uint8Array<ArrayBufferLike>).optional(),

    // IDs
    treasuryAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    autoRenewAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),

    // Keys
    adminKey: z.instanceof(PublicKey).optional(),
    supplyKey: z.instanceof(PublicKey).optional(),
    wipeKey: z.instanceof(PublicKey).optional(),
    freezeKey: z.instanceof(PublicKey).optional(),
    kycKey: z.instanceof(PublicKey).optional(),
    feeScheduleKey: z.instanceof(PublicKey).optional(),
    pauseKey: z.instanceof(PublicKey).optional(),
    metadataKey: z.instanceof(PublicKey).optional(),
  });
