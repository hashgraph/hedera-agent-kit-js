import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { submitTopicMessageParameters } from '@/shared/parameter-schemas/consensus.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

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

const submitTopicMessage = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof submitTopicMessageParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseSubmitTopicMessage(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.submitTopicMessage(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to submit message to topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[submit_topic_message_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const SUBMIT_TOPIC_MESSAGE_TOOL = 'submit_topic_message_tool';

const tool = (context: Context): Tool => ({
  method: SUBMIT_TOPIC_MESSAGE_TOOL,
  name: 'Submit Topic Message',
  description: submitTopicMessagePrompt(context),
  parameters: submitTopicMessageParameters(context),
  execute: submitTopicMessage,
});

export default tool;
