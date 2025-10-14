import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { updateAccountParameters } from '@/shared/parameter-schemas/account.zod';

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
- accountMemo (string, optional) - memo to be set for the upgraded account
- declineStakingReward (boolean, optional)
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled account update created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Account successfully updated.
Transaction ID: ${response.transactionId}`;
};

const updateAccount = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof updateAccountParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseUpdateAccount(
      params,
      context,
      client,
    );

    // Build transaction and wrap in SchedulingTransaction if needed
    const tx = HederaBuilder.updateAccount(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to update account';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[update_account_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
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
