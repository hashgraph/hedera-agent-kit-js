import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteTopicParameters } from '@/shared/parameter-schemas/consensus.zod';

const deleteTopicPrompt = (_context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
This tool will delete a given Hedera network topic.

Parameters:
- topicId (str, required): id of topic to delete
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Topic with id ${response.topicId?.toString()} deleted successfully. Transaction id ${response.transactionId.toString()}`;
};

const deleteTopic = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof deleteTopicParameters>>,
) => {
  try {
    const mirrornodeService: IHederaMirrornodeService = getMirrornodeService(
      context.mirrornodeService!,
      client.ledgerId!,
    );
    const normalisedParams = HederaParameterNormaliser.normaliseDeleteTopic(
      params,
      context,
      client,
      mirrornodeService,
    );
    const tx = HederaBuilder.deleteTopic(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to delete the topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_topic_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const DELETE_TOPIC_TOOL = 'delete_topic_tool';

const tool = (context: Context): Tool => ({
  method: DELETE_TOPIC_TOOL,
  name: 'Delete Topic',
  description: deleteTopicPrompt(context),
  parameters: deleteTopicParameters(context),
  execute: deleteTopic,
});

export default tool;
