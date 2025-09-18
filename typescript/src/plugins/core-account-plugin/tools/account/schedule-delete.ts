import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { scheduleDeleteTransactionParameters } from '@/shared/parameter-schemas/account.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const scheduleDeletePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will delete a scheduled transaction (by admin) so it will not execute.

Parameters:
- scheduleId (string, required): The ID of the scheduled transaction to delete
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Scheduled transaction successfully deleted. Transaction ID: ${response.transactionId}`;
};

const scheduleDelete = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>>,
) => {
  try {
    const tx = HederaBuilder.deleteScheduleTransaction(params);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to delete scheduled transaction';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[schedule_delete_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const SCHEDULE_DELETE_TOOL = 'schedule_delete_tool';

const tool = (context: Context): Tool => ({
  method: SCHEDULE_DELETE_TOOL,
  name: 'Delete Scheduled Transaction',
  description: scheduleDeletePrompt(context),
  parameters: scheduleDeleteTransactionParameters(context),
  execute: scheduleDelete,
});

export default tool;


