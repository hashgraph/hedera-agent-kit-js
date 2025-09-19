import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { createTopicParameters } from '@/shared/parameter-schemas/consensus.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const createTopicPrompt = (_context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
This tool will create a new topic on the Hedera network.

Parameters:
- topicMemo (str, optional): A memo for the topic
- transactionMemo (str, optional): An optional memo to include on the submitted transaction
- isSubmitKey (bool, optional): Whether to set a submit key for the topic. Set to true if user wants to set a submit key, otherwise false
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Topic created successfully with topic id ${response.topicId?.toString()} and transaction id ${response.transactionId.toString()}`;
};

const createTopic = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createTopicParameters>>,
) => {
  try {
    const mirrornodeService: IHederaMirrornodeService = getMirrornodeService(
      context.mirrornodeService!,
      client.ledgerId!,
    );
    const normalisedParams = await HederaParameterNormaliser.normaliseCreateTopicParams(
      params,
      context,
      client,
      mirrornodeService,
    );
    const tx = HederaBuilder.createTopic(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to create topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_topic_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const CREATE_TOPIC_TOOL = 'create_topic_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_TOPIC_TOOL,
  name: 'Create Topic',
  description: createTopicPrompt(context),
  parameters: createTopicParameters(context),
  execute: createTopic,
});

export default tool;
