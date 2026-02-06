import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { createTopicParameters } from '@/shared/parameter-schemas/consensus.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const createTopicPrompt = (_context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
This tool will create a new topic on the Hedera network.

Parameters:
- topicMemo (str, optional): A memo stored permanently on the topic itself (not the transaction)
- transactionMemo (str, optional): A memo attached to the transaction (separate from topicMemo). Use this when the user says "transaction memo" or "set the memo on the transaction"
- isSubmitKey (bool, optional): Whether to set a submit key for the topic. Set to true if user wants to set a submit key, otherwise false
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Topic created successfully with topic id ${response.topicId?.toString()} and transaction id ${response.transactionId.toString()}`;
};

export const CREATE_TOPIC_TOOL = 'create_topic_tool';

export class CreateTopicTool extends BaseTool {
  method = CREATE_TOPIC_TOOL;
  name = 'Create Topic';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = createTopicPrompt(context);
    this.parameters = createTopicParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof createTopicParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService: IHederaMirrornodeService = getMirrornodeService(
      context.mirrornodeService!,
      client.ledgerId!,
    );
    return await HederaParameterNormaliser.normaliseCreateTopicParams(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.createTopic(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to create topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_topic_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new CreateTopicTool(context);

export default tool;
