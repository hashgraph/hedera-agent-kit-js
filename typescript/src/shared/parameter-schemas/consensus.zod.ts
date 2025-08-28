import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { PublicKey } from '@hashgraph/sdk';

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
  });

export const submitTopicMessageParameters = (_context: Context = {}) => {
  return z.object({
    topicId: z.string().describe('The ID of the topic to submit the message to'),
    message: z.string().describe('The message to submit to the topic'),
  });
};

export const submitTopicMessageParametersNormalised = (_context: Context = {}) =>
  submitTopicMessageParameters(_context).extend({}); // currently no additional fields are needed
