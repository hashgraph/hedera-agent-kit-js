import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { ERC721_MINT_FUNCTION_ABI, ERC721_MINT_FUNCTION_NAME } from '@/shared/constants/contracts';
import { mintERC721Parameters } from '@/shared/parameter-schemas/evm.zod';

const mintERC721Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  const toAddressDesc = PromptGenerator.getAnyAddressParameterDescription('toAddress', context);

  return `
${contextSnippet}

This tool will mint a new ERC721 token on Hedera. ERC721 is an EVM compatible non fungible token (NFT).

Parameters:
- contractId (str, required): The id of the ERC721 contract
- ${toAddressDesc}
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Mint ERC721 token 0.0.6486793 to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means minting the ERC721 token with contract id 0.0.6486793 to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
Example: "Mint ERC721 token 0.0.6486793 to 0.0.6486793" means minting the ERC721 token with contract id 0.0.6486793 to the 0.0.6486793 Hedera account id.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled minting of ERC721 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC721 token minted successfully.
    Transaction ID: ${response.transactionId}`;

const mintERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof mintERC721Parameters>>,
) => {
  try {
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);

    const normalisedParams = await HederaParameterNormaliser.normaliseMintERC721Params(
      params,
      ERC721_MINT_FUNCTION_ABI,
      ERC721_MINT_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to mint ERC721';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[mint_erc721_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const MINT_ERC721_TOOL = 'mint_erc721_tool';

const tool = (context: Context): Tool => ({
  method: MINT_ERC721_TOOL,
  name: 'Mint ERC721',
  description: mintERC721Prompt(context),
  parameters: mintERC721Parameters(context),
  execute: mintERC721,
});

export default tool;
