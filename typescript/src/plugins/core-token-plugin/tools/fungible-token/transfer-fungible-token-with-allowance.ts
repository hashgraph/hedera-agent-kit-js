import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

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
  - amount (number): Amount of tokens to transfer in display unit
- transactionMemo (string, optional): Optional memo for the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: Spend allowance from account 0.0.1002 to send 25 fungible tokens with id 0.0.33333 to 0.0.2002
Example 2: Use allowance from 0.0.1002 to send 50 TKN (FT token id: '0.0.33333') to 0.0.2002 and 75 TKN to 0.0.3003
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled allowance transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Fungible tokens successfully transferred with allowance.
Transaction ID: ${response.transactionId}`;
};

const transferFungibleTokenWithAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>>,
) => {
  try {
    const mirrornode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    const normalisedParams =
      await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        context,
        client,
        mirrornode,
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
