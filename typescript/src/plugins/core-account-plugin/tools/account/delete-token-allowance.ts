import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';

const deleteTokenAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool deletes token allowance(s) from the owner to the spender.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- tokenIds (array, required): List of token IDs whose allowances should be removed
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
Example: "Delete token allowance for account 0.0.123 on token 0.0.456". Means that 0.0.123 is the spenderId, 0.0.456 is the tokenId and the ownerId is taken from context or default operator.
Example 2: "Delete token allowance given from 0.0.1001 to account 0.0.2002 for token 0.0.3003". Means that 0.0.1001 is the ownerId, 0.0.2002 is the spenderId and 0.0.3003 is the tokenId.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token allowance(s) deleted successfully. Transaction ID: ${response.transactionId}`;
};

const deleteTokenAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof deleteTokenAllowanceParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseDeleteTokenAllowance(
      params,
      context,
      client,
      mirrornodeService,
    );

    const tx = HederaBuilder.approveTokenAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to delete token allowance(s).';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_token_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const DELETE_TOKEN_ALLOWANCE_TOOL = 'delete_token_allowance_tool';

const tool = (context: Context): Tool => ({
  method: DELETE_TOKEN_ALLOWANCE_TOOL,
  name: 'Delete Token Allowance',
  description: deleteTokenAllowancePrompt(context),
  parameters: deleteTokenAllowanceParameters(context),
  execute: deleteTokenAllowance,
});

export default tool;
