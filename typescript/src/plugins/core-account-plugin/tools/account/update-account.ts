import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { updateAccountParameters } from '@/shared/parameter-schemas/has.zod';

const updateAccountPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will update an existing Hedera account. Only provided fields will be updated.

Parameters:
- ${accountDesc}
- accountId (string, optional) Account ID to update (e.g., 0.0.xxxxx). If not provided, operator account ID will be used
- maxAutomaticTokenAssociations (number, optional)
- stakedAccountId (string, optional)
- accountMemo (string, optional)
- declineStakingReward (boolean, optional)
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Account successfully updated. Transaction ID: ${response.transactionId}`;
};

const updateAccount = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof updateAccountParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseUpdateAccount(
      params,
      context,
      client,
    );

    let tx = HederaBuilder.updateAccount(normalisedParams);

    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to update account';
  }
};

export const UPDATE_ACCOUNT_TOOL = 'update_account_tool';

const tool = (context: Context): Tool => ({
  method: UPDATE_ACCOUNT_TOOL,
  name: 'Update Account',
  description: updateAccountPrompt(context),
  parameters: updateAccountParameters(context),
  execute: updateAccount,
});

export default tool;
