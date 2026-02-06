import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { scheduleDeleteTransactionParameters } from '@/shared/parameter-schemas/account.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const SCHEDULE_DELETE_TOOL = 'schedule_delete_tool';

export class ScheduleDeleteTool extends BaseTool {
  method = SCHEDULE_DELETE_TOOL;
  name = 'Delete Scheduled Transaction';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = scheduleDeletePrompt(context);
    this.parameters = scheduleDeleteTransactionParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>>,
    _context: Context,
    _client: Client,
  ) {
    return params;
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.deleteScheduleTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to delete scheduled transaction';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[schedule_delete_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new ScheduleDeleteTool(context);

export default tool;
