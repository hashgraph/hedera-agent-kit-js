import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { airdropFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const airdropFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will airdrop a fungible token on Hedera.

Parameters:
- tokenId (str, required): The id of the token
- ${sourceAccountDesc}
- recipients (array, required): A list of recipient objects, each containing:
  - accountId (string): The recipient's account ID (e.g., "0.0.1234")
  - amount (number or string): The amount of tokens to send to that recipient (in base units)
- transactionMemo (str, optional): Optional memo for the transaction
${usageInstructions}

If the user specifies multiple recipients in a single request, include them all in **one tool call** as a list of recipients.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token successfully airdropped with transaction id ${response.transactionId.toString()}`;
};

const airdropFungibleToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseAirdropFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
    const tx = HederaBuilder.airdropFungibleToken(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to airdrop fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[airdrop_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const AIRDROP_FUNGIBLE_TOKEN_TOOL = 'airdrop_fungible_token_tool';

const tool = (context: Context): Tool => ({
  method: AIRDROP_FUNGIBLE_TOKEN_TOOL,
  name: 'Airdrop Fungible Token',
  description: airdropFungibleTokenPrompt(context),
  parameters: airdropFungibleTokenParameters(context),
  execute: airdropFungibleToken,
});

export default tool;
