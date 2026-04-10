import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { submitTopicMessageParameters } from '@/shared/parameter-schemas/consensus.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const submitTopicMessagePrompt = (context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
This tool will submit a message to a topic on the Hedera network.

Parameters:
- topicId (str, required): The ID of the topic to submit the message to
- message (str, required): The message to submit to the topic
- transactionMemo (str, optional): An optional memo to include on the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Message submitted successfully with transaction id ${response.transactionId.toString()}`;
};

export const SUBMIT_TOPIC_MESSAGE_TOOL = 'submit_topic_message_tool';

export class SubmitTopicMessageTool extends BaseTool {
  method = SUBMIT_TOPIC_MESSAGE_TOOL;
  name = 'Submit Topic Message';
  description: string;
  parameters: ReturnType<typeof submitTopicMessageParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = submitTopicMessagePrompt(context);
    this.parameters = submitTopicMessageParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof submitTopicMessageParameters>>,
    context: Context,
    client: Client,
  ) {
    return await HederaParameterNormaliser.normaliseSubmitTopicMessage(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.submitTopicMessage(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to submit message to topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[submit_topic_message_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new SubmitTopicMessageTool(context);

export default tool;
