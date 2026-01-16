import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferHbarPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer HBAR to an account.

Parameters:
- transfers (array of objects, required): List of HBAR transfers. Each object should contain:
  - accountId (string): Recipient account ID
  - amount (number): Amount of HBAR to transfer
- ${sourceAccountDesc}
- transactionMemo (string, optional): Optional memo for the transfer HBAR transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled HBAR transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `HBAR successfully transferred.
Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';

export class TransferHbarTool extends BaseTool {
  method = TRANSFER_HBAR_TOOL;
  name = 'Transfer HBAR';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferHbarPrompt(context);
    this.parameters = transferHbarParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferHbarParameters>>,
    context: Context,
    client: Client,
  ) {
    return await HederaParameterNormaliser.normaliseTransferHbar(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    return HederaBuilder.transferHbar(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, context: Context): Promise<any> {
    const desc = 'Failed to transfer HBAR';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new TransferHbarTool(context);

export default tool;
