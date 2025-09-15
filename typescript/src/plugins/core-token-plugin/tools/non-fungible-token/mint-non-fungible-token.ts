import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { mintNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const mintNonFungibleTokenPrompt = (_context: Context = {}) => {
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `

This tool will mint NFTs with its unique metadata for the class of NFTs (non-fungible tokens) defined by the tokenId on Hedera.

Parameters:
- tokenId (str, required): The id of the token
- uris (array, required): An array of strings (URIs) of maximum size 10 hosting the NFT metadata
${usageInstructions}

Example: "Mint 0.0.6465503 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json" means minting an NFT with the given metadata URI for the class of NFTs defined by the token with id 0.0.6465503.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token ${response.tokenId?.toString()} successfully minted with transaction id ${response.transactionId.toString()}`;
};

const mintNonFungibleToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(
      params,
      context,
    );
    const tx = HederaBuilder.mintNonFungibleToken(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to mint non-fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[mint_non_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const MINT_NON_FUNGIBLE_TOKEN_TOOL = 'mint_non_fungible_token_tool';

const tool = (context: Context): Tool => ({
  method: MINT_NON_FUNGIBLE_TOKEN_TOOL,
  name: 'Mint Non-Fungible Token',
  description: mintNonFungibleTokenPrompt(context),
  parameters: mintNonFungibleTokenParameters(context),
  execute: mintNonFungibleToken,
});

export default tool;
