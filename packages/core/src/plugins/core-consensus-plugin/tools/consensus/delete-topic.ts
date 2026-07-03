import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import { Client } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteTopicParameters } from '@/shared/parameter-schemas/consensus.zod';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const DELETE_TOPIC_TOOL = 'delete_topic_tool';

export class DeleteTopicTool extends BaseTransactionTool {
  method = DELETE_TOPIC_TOOL;
  name = 'Delete Topic';
  description: string;
  parameters: ReturnType<typeof deleteTopicParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = deleteTopicPrompt(context);
    this.parameters = deleteTopicParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof deleteTopicParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService: IHederaMirrornodeService = getMirrornodeService(
      context.mirrornodeService!,
      client.ledgerId!,
    );
    return HederaParameterNormaliser.normaliseDeleteTopic(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.deleteTopic(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context: Context): BaseTransactionTool => new DeleteTopicTool(context);

export default tool;
