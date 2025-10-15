import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
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
  const fromAddressDesc = PromptGenerator.getAnyAddressParameterDescription('fromAddress', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer an existing ERC721 token on Hedera. ERC721 is an EVM compatible non fungible token (NFT).

Parameters:
- contractId (str, required): The id of the ERC721 contract
- ${fromAddressDesc}
- toAddress (str, required): The address to which the token will be transferred. This can be the EVM address or the Hedera account id.
- tokenId (number, required): The ID of the transferred token
${PromptGenerator.getScheduledTransactionParamsDescription(context)}


${PromptGenerator.getParameterUsageInstructions()}

${usageInstructions}

Example:
"Transfer ERC721 token 0.0.6486793 with id 0 from 0xd94...580b to 0.0.6486793" transfers token ID 0 from the given EVM address to the given Hedera account.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled transfer of ERC721 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC721 token transferred successfully.
    Transaction ID: ${response.transactionId}`;

const transferERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferERC721Parameters>>,
) => {
  const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);

  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferERC721Params(
      params,
      ERC721_TRANSFER_FUNCTION_ABI,
      ERC721_TRANSFER_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );

    const tx = HederaBuilder.executeTransaction(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const message =
      'Failed to transfer ERC721' + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_erc721_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
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
