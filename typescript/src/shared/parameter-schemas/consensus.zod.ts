import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { PublicKey } from '@hashgraph/sdk';

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

export const submitTopicMessageParameters = (_context: Context = {}) => {
  return z.object({
    topicId: z.string().describe('The ID of the topic to submit the message to'),
    message: z.string().describe('The message to submit to the topic'),
    transactionMemo: z
      .string()
      .optional()
      .describe('An optional memo to include on the submitted transaction (optional).'),
  });
};

export const submitTopicMessageParametersNormalised = (_context: Context = {}) =>
  submitTopicMessageParameters(_context).extend({});

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
