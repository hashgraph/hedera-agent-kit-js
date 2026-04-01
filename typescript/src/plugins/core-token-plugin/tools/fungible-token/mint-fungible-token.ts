import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { mintFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const mintFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will mint a given amount (supply) of an existing HTS fungible token on Hedera.

Parameters:
- tokenId (str, required): The id of the token
- amount (number, required): The amount to be minted. Given in display units, the tool will handle parsing
${usageInstructions}

Example: "Mint 1 of 0.0.6458037" means minting the amount of 1 of the token with id 0.0.6458037.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled mint transaction created successfully.
Transaction ID: ${response.transactionId.toString()}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Tokens successfully minted.
Transaction ID: ${response.transactionId.toString()}`;
};

export const MINT_FUNGIBLE_TOKEN_TOOL = 'mint_fungible_token_tool';

export class MintFungibleTokenTool extends BaseTool {
  method = MINT_FUNGIBLE_TOKEN_TOOL;
  name = 'Mint Fungible Token';
  description: string;
  parameters: ReturnType<typeof mintFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = mintFungibleTokenPrompt(context);
    this.parameters = mintFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof mintFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return HederaParameterNormaliser.normaliseMintFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.mintFungibleToken(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to mint fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[mint_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new MintFungibleTokenTool(context);

export default tool;
