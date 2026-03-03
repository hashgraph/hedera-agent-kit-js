import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { createNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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
- supplyType (str, optional): The supply type of the token. Can be "finite" or "infinite". Defaults to "finite"
- maxSupply (int, optional): Maximum NFT supply. Only applicable if supplyType is "finite". Defaults to 100 if not specified
- isSupplyKey (boolean, optional): If user wants to set supply key set to true, otherwise false
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

export const CREATE_NON_FUNGIBLE_TOKEN_TOOL = 'create_non_fungible_token_tool';

export class CreateNonFungibleTokenTool extends BaseTool {
  method = CREATE_NON_FUNGIBLE_TOKEN_TOOL;
  name = 'Create Non-Fungible Token';
  description: string;
  parameters: ReturnType<typeof createNonFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = createNonFungibleTokenPrompt(context);
    this.parameters = createNonFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.createNonFungibleToken(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to create non-fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_non_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new CreateNonFungibleTokenTool(context);

export default tool;
