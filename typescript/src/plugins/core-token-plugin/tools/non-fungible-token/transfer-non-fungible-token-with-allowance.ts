import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferNonFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const transferNonFungibleTokenWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool will transfer non-fungible tokens (NFTs) using an existing **token allowance**.

Parameters:
- sourceAccountId (string, required): The token owner (allowance granter)
- tokenId (string, required): The NFT token ID to transfer (e.g. "0.0.12345")
- recipients (array, required): List of objects specifying recipients and serial numbers
  - recipientId (string): Account to transfer to
  - serialNumber (string): NFT serial number to transfer
- transactionMemo (string, optional): Optional memo for the transaction

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Non-fungible tokens successfully transferred with allowance. Transaction ID: ${response.transactionId}`;
};

const transferNonFungibleTokenWithAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParameters>>,
) => {
  try {
    const normalisedParams =
      HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(params, context);

    const tx = HederaBuilder.transferNonFungibleTokenWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer non-fungible token with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_non_fungible_token_with_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
  'transfer_non_fungible_token_with_allowance_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
  name: 'Transfer Non Fungible Token with Allowance',
  description: transferNonFungibleTokenWithAllowancePrompt(context),
  parameters: transferNonFungibleTokenWithAllowanceParameters(context).innerType(),
  execute: transferNonFungibleTokenWithAllowance,
});

export default tool;
