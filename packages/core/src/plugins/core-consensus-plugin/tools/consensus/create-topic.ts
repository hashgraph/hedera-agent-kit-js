import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { createTopicParameters } from '@/shared/parameter-schemas/consensus.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const createTopicPrompt = (context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
This tool will create a new topic (consensus topic) on the Hedera network (HCS). Use this for any request to: create a topic, open a consensus topic, or start a new communication channel.
All parameters are optional!

Parameters:
- topicMemo (str, optional): A memo stored permanently on the topic itself (not the transaction). It is not required to set a topic memo!
- transactionMemo (str, optional): A memo attached to the transaction (separate from topicMemo). Use this when the user says "transaction memo" or "set the memo on the transaction"
- adminKey (bool or str, optional): Admin key for the topic. ONLY set this if the user wants to be able to UPDATE or DELETE the topic later. Pass boolean value 'true' to use operator key, or string value public key.
- submitKey (bool or str, optional): Submit key for the topic. ONLY set this if the user explicitly wants to RESTRICT who can submit messages to the topic. If they say "do NOT restrict access", do NOT set this. Pass boolean value 'true' to use operator key, or string value public key.
${PromptGenerator.getScheduledTransactionParamsDescription(context)}
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
  parameters: ReturnType<typeof createTopicParameters>;
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
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new CreateTopicTool(context);

export default tool;
