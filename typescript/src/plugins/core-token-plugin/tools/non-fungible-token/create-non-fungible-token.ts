import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { createNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const createNonFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const treasuryAccountDesc = PromptGenerator.getAccountParameterDescription(
    'treasuryAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates a non-fungible token (NFT) on Hedera.

Parameters:
- tokenName (str, required): Name of the token
- tokenSymbol (str, required): Symbol of the token
- maxSupply (int, optional): Maximum NFT supply. Defaults to 100 if not provided
- ${treasuryAccountDesc}
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled transaction created successfully.
Transaction ID: ${response.transactionId.toString()}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  const tokenIdStr = response.tokenId ? response.tokenId.toString() : 'unknown';
  return `Token created successfully.
Transaction ID: ${response.transactionId.toString()}
Token ID: ${tokenIdStr}`;
};

const createNonFungibleToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
    const tx = HederaBuilder.createNonFungibleToken(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to create non-fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_non_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const CREATE_NON_FUNGIBLE_TOKEN_TOOL = 'create_non_fungible_token_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  name: 'Create Non-Fungible Token',
  description: createNonFungibleTokenPrompt(context),
  parameters: createNonFungibleTokenParameters(context),
  execute: createNonFungibleToken,
});

export default tool;
