import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarWithAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

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

const transferHbarWithAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferHbarWithAllowanceParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseTransferHbarWithAllowance(
      params,
      context,
      client,
    );

    const tx = HederaBuilder.transferHbarWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer HBAR with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_with_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_HBAR_WITH_ALLOWANCE_TOOL = 'transfer_hbar_with_allowance_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
  name: 'Transfer HBAR with allowance',
  description: transferHbarWithAllowancePrompt(context),
  parameters: transferHbarWithAllowanceParameters(context),
  execute: transferHbarWithAllowance,
});

export default tool;
