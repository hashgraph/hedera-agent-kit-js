import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hashgraph/sdk';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  ERC721_TRANSFER_FUNCTION_ABI,
  ERC721_TRANSFER_FUNCTION_NAME,
} from '@/shared/constants/contracts';
import { transferERC721Parameters } from '@/shared/parameter-schemas/evm.zod';

const transferERC721Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer an existing ERC721 token on Hedera.

Parameters:
- contractId (str, required): The id of the ERC721 contract
- fromAddress (str, required): The address from which the token will be transfered. This can be the EVM address or the Hedera account id.
- toAddress (str, required): The address to which the token will be transferred. This can be the EVM address or the Hedera account id.
- tokenId (number, required): The ID of the transfered token
${usageInstructions}

Example: "Transfer ERC721 token 0.0.6486793 with id 0 from 0xd94dc7f82f103757f715514e4a37186be6e4580b to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means transfering the ERC721 token (identified by 0) with contract id 0.0.6486793 from the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
Example: "Transfer ERC721 token 0.0.6486793 with id 0 from 0.0.6486793 to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means transfering the ERC721 token (identified by 0) with contract id 0.0.6486793 from the 0.0.6486793 Hedera account id to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
`;
};

const transferERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferERC721Parameters>>,
) => {
  try {
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);

    const normalisedParams = await HederaParameterNormaliser.normaliseTransferERC721Params(
      params,
      ERC721_TRANSFER_FUNCTION_ABI,
      ERC721_TRANSFER_FUNCTION_NAME,
      context,
      mirrorNode,
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result = await handleTransaction(tx, client, context);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to transfer ERC721';
  }
};

export const TRANSFER_ERC721_TOOL = 'transfer_erc721_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_ERC721_TOOL,
  name: 'Transfer ERC721',
  description: transferERC721Prompt(context),
  parameters: transferERC721Parameters(context),
  execute: transferERC721,
});

export default tool;
