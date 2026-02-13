import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteAccountParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const deleteAccountPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will delete an existing Hedera account. The remaining balance of the account will be transferred to the transferAccountId if provided, otherwise the operator account will be used.

Parameters:
- ${accountDesc}
- accountId (str, required): The account ID to delete
- transferAccountId (str, optional): The account ID to transfer the remaining balance to. If not provided, the operator account will be used.
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Account successfully deleted. Transaction ID: ${response.transactionId}`;
};

export const DELETE_ACCOUNT_TOOL = 'delete_account_tool';

export class DeleteAccountTool extends BaseTool {
  method = DELETE_ACCOUNT_TOOL;
  name = 'Delete Account';
  description: string;
  parameters: ReturnType<typeof deleteAccountParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = deleteAccountPrompt(context);
    this.parameters = deleteAccountParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof deleteAccountParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseDeleteAccount(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.deleteAccount(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to delete account';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_account_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new DeleteAccountTool(context);

export default tool;
