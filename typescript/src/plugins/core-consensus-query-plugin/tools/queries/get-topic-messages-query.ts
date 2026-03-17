import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { topicMessagesQueryParameters } from '@/shared/parameter-schemas/consensus.zod';
import { Client } from '@hashgraph/sdk';
import { z } from 'zod';
import { BaseTool } from '@/shared/tools';
import { TopicMessage, TopicMessagesQueryParams } from '@/shared/hedera-utils/mirrornode/types';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

export const getTopicMessagesQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the messages for a given Hedera topic.

Parameters:
- topicId (str, required): The topic ID to query
- startTime (datetime, optional): The start datetime to query. If set, the messages will be returned after this datetime
- endTime (datetime, optional): The end datetime to query. If set, the messages will be returned before this datetime
- limit (int, optional): The limit of messages to query. If set, the number of messages to return
${usageInstructions}
`;
};

const postProcess = (messages: TopicMessage[], topicId: string) => {
  if (messages.length === 0) {
    return `No messages found for topic ${topicId}.`;
  }

  const messagesText = messages.map(
    message =>
      `${Buffer.from(message.message, 'base64').toString('utf-8')} - posted at: ${message.consensus_timestamp}\n`,
  );

  return `Messages for topic ${topicId}:
  --- Messages ---
  ${messagesText}
  `;
};

const getTopicMessagesQueryParams = (
  params: z.infer<ReturnType<typeof topicMessagesQueryParameters>>,
): TopicMessagesQueryParams => {
  return {
    topicId: params.topicId,
    lowerTimestamp: params.startTime
      ? `${Math.floor(new Date(params.startTime).getTime() / 1000)}.000000000`
      : '',
    upperTimestamp: params.endTime
      ? `${Math.floor(new Date(params.endTime).getTime() / 1000)}.000000000`
      : '',
    limit: params.limit || 100,
  };
};

const convertMessagesFromBase64ToString = (messages: TopicMessage[]) => {
  return messages.map(message => {
    return {
      ...message,
      message: Buffer.from(message.message, 'base64').toString('utf-8'),
    };
  });
};

export const GET_TOPIC_MESSAGES_QUERY_TOOL = 'get_topic_messages_query_tool';

export class GetTopicMessagesQueryTool extends BaseTool {
  method = GET_TOPIC_MESSAGES_QUERY_TOOL;
  name = 'Get Topic Messages';
  description: string;
  parameters: ReturnType<typeof topicMessagesQueryParameters>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getTopicMessagesQueryPrompt(context);
    this.parameters = topicMessagesQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof topicMessagesQueryParameters>>,
    context: Context,
    _client: Client,
  ) {
    return HederaParameterNormaliser.parseParamsWithSchema(
      params,
      topicMessagesQueryParameters,
      context,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const messages = await mirrornodeService.getTopicMessages(
      getTopicMessagesQueryParams(normalisedParams),
    );

    return {
      raw: {
        topicId: messages.topicId,
        messages: convertMessagesFromBase64ToString(messages.messages),
      },
      humanMessage: postProcess(messages.messages, normalisedParams.topicId),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null; // Not applicable for query tools
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to get topic messages';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_topic_messages_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetTopicMessagesQueryTool(context);

export default tool;
