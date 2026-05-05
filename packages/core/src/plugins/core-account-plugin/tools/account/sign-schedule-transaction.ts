import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { signScheduleTransactionParameters } from '@/shared/parameter-schemas/account.zod';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const SIGN_SCHEDULE_TRANSACTION_TOOL = 'sign_schedule_transaction_tool';

export class SignScheduleTransactionTool extends BaseTool {
  method = SIGN_SCHEDULE_TRANSACTION_TOOL;
  name = 'Sign Scheduled Transaction';
  description: string;
  parameters: ReturnType<typeof signScheduleTransactionParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = signScheduleTransactionPrompt(context);
    this.parameters = signScheduleTransactionParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof signScheduleTransactionParameters>>,
    _context: Context,
    _client: Client,
  ) {
    return params;
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.signScheduleTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to sign scheduled transaction';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[sign_schedule_transaction_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new SignScheduleTransactionTool(context);

export default tool;
