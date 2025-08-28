import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

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
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `HBAR successfully transferred. Transaction ID: ${response.transactionId}`;
};

const transferHbar = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferHbarParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseTransferHbar(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.transferHbar(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to transfer HBAR';
  }
};

export const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_HBAR_TOOL,
  name: 'Transfer HBAR',
  description: transferHbarPrompt(context),
  parameters: transferHbarParameters(context),
  execute: transferHbar,
});

export default tool;
