import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteAccountParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

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

const deleteAccount = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof deleteAccountParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseDeleteAccount(
      params,
      context,
      client,
    );

    let tx = HederaBuilder.deleteAccount(normalisedParams);

    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to delete account';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_account_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const DELETE_ACCOUNT_TOOL = 'delete_account_tool';

const tool = (context: Context): Tool => ({
  method: DELETE_ACCOUNT_TOOL,
  name: 'Delete Account',
  description: deleteAccountPrompt(context),
  parameters: deleteAccountParameters(context),
  execute: deleteAccount,
});

export default tool;
