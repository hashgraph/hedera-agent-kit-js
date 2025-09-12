import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { createFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const createFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const treasuryAccountDesc = PromptGenerator.getAccountParameterDescription(
    'treasuryAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates a fungible token on Hedera.

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, optional): The symbol of the token
- initialSupply (int, optional): The initial supply of the token, defaults to 0
- supplyType (str, optional): The supply type of the token. Can be "finite" or "infinite". Defaults to "finite"
- maxSupply (int, optional): The maximum supply of the token. Only applicable if supplyType is "finite". Defaults to 1,000,000 if not specified
- decimals (int, optional): The number of decimals the token supports. Defaults to 0
- ${treasuryAccountDesc}
- isSupplyKey (boolean, optional): If user wants to set supply key set to true, otherwise false
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token created successfully at address ${response.tokenId?.toString()} with transaction id ${response.transactionId}`;
};

const createFungibleToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createFungibleTokenParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseCreateFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
    const tx = HederaBuilder.createFungibleToken(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    console.error('[CreateFungibleToken] Error creating fungible token:', error);
    const message = error instanceof Error ? error.message : 'Error creating fungible token';

    return {
      raw: {
        status: Status.InvalidTransaction,
        error: message,
      },
      humanMessage: message,
    };
  }
};

export const CREATE_FUNGIBLE_TOKEN_TOOL = 'create_fungible_token_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_FUNGIBLE_TOKEN_TOOL,
  name: 'Create Fungible Token',
  description: createFungibleTokenPrompt(context),
  parameters: createFungibleTokenParameters(context),
  execute: createFungibleToken,
});

export default tool;
