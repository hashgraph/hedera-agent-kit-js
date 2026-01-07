import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { AccountId, PublicKey, TopicId } from '@hashgraph/sdk';
import {
  optionalScheduledTransactionParams,
  optionalScheduledTransactionParamsNormalised,
} from '@/shared/parameter-schemas/common.zod';

export const getTopicInfoParameters = (_context: Context = {}) => {
  return z.object({
    topicId: z.string().describe('The topic ID to query.'),
  });
};

export const createTopicParameters = (_context: Context = {}) => {
  return z.object({
    isSubmitKey: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to set a submit key for the topic (optional)'),
    topicMemo: z.string().optional().describe('Memo for the topic (optional)'),
    transactionMemo: z
      .string()
      .optional()
      .describe('An optional memo to include on the submitted transaction (optional).'),
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

export const submitTopicMessageParameters = (_context: Context = {}) =>
  optionalScheduledTransactionParams(_context).extend({
    topicId: z.string().describe('The ID of the topic to submit the message to'),
    message: z.string().describe('The message to submit to the topic'),
    transactionMemo: z
      .string()
      .optional()
      .describe('An optional memo to include on the submitted transaction (optional).'),
  });

export const submitTopicMessageParametersNormalised = (_context: Context = {}) =>
  submitTopicMessageParameters(_context)
    .omit({ schedulingParams: true })
    .merge(optionalScheduledTransactionParamsNormalised(_context));

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

export const updateTopicParameters = (_context: Context = {}) =>
  z.object({
    topicId: z.string().describe('The ID of the topic to update (e.g., 0.0.12345).'),
    topicMemo: z.string().optional().describe('Optional new memo for the topic.'),
    adminKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New admin key. Pass boolean `true` to use the operator/user key, or provide a Hedera-compatible public key string.',
      ),
    submitKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New submit key. Pass boolean `true` to use the operator/user key, or provide a Hedera-compatible public key string.',
      ),
    autoRenewAccountId: z
      .string()
      .optional()
      .describe('Account to automatically pay for topic renewal (Hedera account ID).'),
    autoRenewPeriod: z.number().optional().describe('Auto renew period in seconds.'),
    expirationTime: z
      .union([z.string(), z.instanceof(Date)])
      .optional()
      .describe('New expiration time for the topic (ISO string or Date).'),
  });

export const updateTopicParametersNormalised = (_context: Context = {}) =>
  z.object({
    topicId: z.instanceof(TopicId),
    topicMemo: z.string().optional(),
    adminKey: z.instanceof(PublicKey).optional(),
    submitKey: z.instanceof(PublicKey).optional(),
    autoRenewAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    autoRenewPeriod: z.number().optional(),
    expirationTime: z.instanceof(Date).optional(),
  });
