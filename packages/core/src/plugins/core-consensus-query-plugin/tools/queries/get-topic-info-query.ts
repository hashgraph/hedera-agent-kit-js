import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { Client } from '@hiero-ledger/sdk';
import { BaseTool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TopicInfo } from '@/shared/hedera-utils/mirrornode/types';
import { getTopicInfoParameters } from '@/shared/parameter-schemas/consensus.zod';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';

export const getTopicInfoQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the information for a given Hedera topic (HCS).

Parameters:
- topicId (str): The topic ID to query for.
${usageInstructions}
`;
};

const postProcess = (topic: TopicInfo) => {
  const formatKey = (key?: { _type?: string; key?: string } | null) => {
    if (!key) return 'Not Set';
    return key._type ? key.key || 'Present' : 'Present';
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'N/A';
    const [seconds] = ts.split('.');
    const date = new Date(Number(seconds) * 1000);
    return date.toISOString();
  };

  return `Here are the details for topic **${topic.topic_id || 'N/A'}**:

- **Memo**: ${topic.memo || 'N/A'}
- **Deleted**: ${topic.deleted ? 'Yes' : 'No'}
- **Sequence Number**: ${topic.sequence_number ?? 'N/A'}

**Timestamps**:
- Created: ${formatTimestamp(topic.created_timestamp)}

**Entity IDs**:
- Auto Renew Account: ${topic.auto_renew_account || 'N/A'}
- Auto Renew Period: ${topic.auto_renew_period ?? 'N/A'}

**Keys**:
- Admin Key: ${formatKey(topic.admin_key)}
- Submit Key: ${formatKey(topic.submit_key)}
`;
};

export const GET_TOPIC_INFO_QUERY_TOOL = 'get_topic_info_query_tool';

export class GetTopicInfoQueryTool extends BaseTool {
  method = GET_TOPIC_INFO_QUERY_TOOL;
  name = 'Get Topic Info';
  description: string;
  parameters: ReturnType<typeof getTopicInfoParameters>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getTopicInfoQueryPrompt(context);
    this.parameters = getTopicInfoParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof getTopicInfoParameters>>,
    _context: Context,
    _client: Client,
  ) {
    return params; // no params normalization is needed
  }

  async coreAction(
    normalisedParams: z.infer<ReturnType<typeof getTopicInfoParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const topicInfo: TopicInfo = {
      ...(await mirrornodeService.getTopicInfo(normalisedParams.topicId)),
      topic_id: normalisedParams.topicId,
    };

    return {
      raw: { topicId: normalisedParams.topicId, topicInfo },
      humanMessage: postProcess(topicInfo),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null; // Not applicable for query tools
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to get topic info';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_topic_info_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetTopicInfoQueryTool(context);

export default tool;
