import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarWithAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferHbarWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer HBAR using an existing allowance.

Parameters:
- sourceAccountId (string, required): Account ID of the HBAR owner (the allowance granter)
- transfers (array of objects, required): List of HBAR transfers. Each object should contain:
  - accountId (string): Recipient account ID
  - amount (number): Amount of HBAR to transfer
- transactionMemo (string, optional): Optional memo for the transfer HBAR with allowance transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `HBAR successfully transferred with allowance. Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_HBAR_WITH_ALLOWANCE_TOOL = 'transfer_hbar_with_allowance_tool';

export class TransferHbarWithAllowanceTool extends BaseTool {
  method = TRANSFER_HBAR_WITH_ALLOWANCE_TOOL;
  name = 'Transfer HBAR with allowance';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferHbarWithAllowancePrompt(context);
    this.parameters = transferHbarWithAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferHbarWithAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseTransferHbarWithAllowance(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.transferHbarWithAllowance(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to transfer HBAR with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_with_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new TransferHbarWithAllowanceTool(context);

export default tool;
