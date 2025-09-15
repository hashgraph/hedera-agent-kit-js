import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { signScheduleTransactionParameters } from '@/shared/parameter-schemas/account.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const signScheduleTransactionPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will sign a scheduled transaction and return the transaction ID.

Parameters:
- scheduleId (string, required): The ID of the scheduled transaction to sign
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Transaction successfully signed. Transaction ID: ${response.transactionId}`;
};

const signScheduleTransaction = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof signScheduleTransactionParameters>>,
) => {
  try {
    const tx = HederaBuilder.signScheduleTransaction(params);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to sign scheduled transaction';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[sign_schedule_transaction_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const SIGN_SCHEDULE_TRANSACTION_TOOL = 'sign_schedule_transaction_tool';

const tool = (context: Context): Tool => ({
  method: SIGN_SCHEDULE_TRANSACTION_TOOL,
  name: 'Sign Scheduled Transaction',
  description: signScheduleTransactionPrompt(context),
  parameters: signScheduleTransactionParameters(context),
  execute: signScheduleTransaction,
});

export default tool;
