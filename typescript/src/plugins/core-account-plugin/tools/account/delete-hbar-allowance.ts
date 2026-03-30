import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { deleteHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const deleteHbarAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool deletes an HBAR allowance from the owner to the spender.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}

Example: "Delete HBAR allowance from 0.0.123 to 0.0.456". Spender account ID is 0.0.456 and the owner account ID is 0.0.123.
Example 2: "Delete HBAR allowance for 0.0.123". Spender account ID is 0.0.123 and the owner account ID was not specified.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `HBAR allowance deleted successfully. Transaction ID: ${response.transactionId}`;
};

export const DELETE_HBAR_ALLOWANCE_TOOL = 'delete_hbar_allowance_tool';

export class DeleteHbarAllowanceTool extends BaseTool {
  method = DELETE_HBAR_ALLOWANCE_TOOL;
  name = 'Delete HBAR Allowance';
  description: string;
  parameters: ReturnType<typeof deleteHbarAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = deleteHbarAllowancePrompt(context);
    this.parameters = deleteHbarAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof deleteHbarAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseDeleteHbarAllowance(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    // deleteHbarAllowance effectively creates an approveHbarAllowance with amount 0
    return HederaBuilder.approveHbarAllowance(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to delete hbar allowance.';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_hbar_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new DeleteHbarAllowanceTool(context);

export default tool;
