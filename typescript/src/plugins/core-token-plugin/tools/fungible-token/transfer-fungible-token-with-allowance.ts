import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const transferFungibleTokenWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer a fungible token using an existing **token allowance**.

Parameters:
- tokenId (string, required): The token ID to transfer (e.g. "0.0.12345")
- sourceAccountId (string, required): Account ID of the token owner (the allowance granter)
- transfers (array of objects, required): List of token transfers. Each object should contain:
  - accountId (string): Recipient account ID
  - amount (number): Amount of tokens to transfer
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Fungible tokens successfully transferred with allowance. Transaction ID: ${response.transactionId}`;
};

const transferFungibleTokenWithAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
      params,
      context,
      client,
    );

    const tx = HederaBuilder.transferFungibleTokenWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer fungible token with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_fungible_token_with_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
  'transfer_fungible_token_with_allowance_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
  name: 'Transfer Fungible Token with Allowance',
  description: transferFungibleTokenWithAllowancePrompt(context),
  parameters: transferFungibleTokenWithAllowanceParameters(context),
  execute: transferFungibleTokenWithAllowance,
});

export default tool;
