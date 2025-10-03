import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { deleteHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

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
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `HBAR allowance deleted successfully. Transaction ID: ${response.transactionId}`;
};

const deleteHbarAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof deleteHbarAllowanceParameters>>,
) => {
  const normalisedParams = HederaParameterNormaliser.normaliseDeleteHbarAllowance(
    params,
    context,
    client,
  );
  // deleteHbarAllowance is implemented using approveHbarAllowance with amount 0
  const tx = HederaBuilder.approveHbarAllowance(normalisedParams);
  return await handleTransaction(tx, client, context, postProcess);
};

export const DELETE_HBAR_ALLOWANCE_TOOL = 'delete_hbar_allowance_tool';

const tool = (context: Context): Tool => ({
  method: DELETE_HBAR_ALLOWANCE_TOOL,
  name: 'Delete HBAR Allowance',
  description: deleteHbarAllowancePrompt(context),
  parameters: deleteHbarAllowanceParameters(context),
  execute: deleteHbarAllowance,
});

export default tool;
