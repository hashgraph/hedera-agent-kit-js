import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import { mintNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const mintNonFungibleTokenPrompt = (_context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `

This tool will mint HTS NFTs with its unique metadata for the class of NFTs (non-fungible tokens) defined by the tokenId on Hedera.
Use this tool when the user provides metadata URI/URIs (ipfs/http links, "metadata", "URI", "URIs") for a Hedera token class id.
If both HTS NFT mint and ERC721 mint appear possible, choose this tool whenever metadata URIs are explicitly provided.

Parameters:
- tokenId (str, required): The id of the token
- uris (array, required): An array of strings (URIs) of maximum size 10 hosting the NFT metadata
${PromptGenerator.getScheduledTransactionParamsDescription(_context)}

${usageInstructions}

Example: "Mint 0.0.6465503 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json" means minting an NFT with the given metadata URI for the class of NFTs defined by the token with id 0.0.6465503.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled mint transaction created successfully.
Transaction ID: ${response.transactionId.toString()}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  const tokenIdStr = response.tokenId ? response.tokenId.toString() : 'unknown';
  return `Token successfully minted.
Transaction ID: ${response.transactionId.toString()}
Token ID: ${tokenIdStr}`;
};

export const MINT_NON_FUNGIBLE_TOKEN_TOOL = 'mint_non_fungible_token_tool';

export class MintNonFungibleTokenTool extends BaseTool {
  method = MINT_NON_FUNGIBLE_TOKEN_TOOL;
  name = 'Mint Non-Fungible Token';
  description: string;
  parameters: ReturnType<typeof mintNonFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = mintNonFungibleTokenPrompt(context);
    this.parameters = mintNonFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.mintNonFungibleToken(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to mint non-fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[mint_non_fungible_token_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new MintNonFungibleTokenTool(context);

export default tool;
