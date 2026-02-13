import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
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
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const TRANSFER_ERC721_TOOL = 'transfer_erc721_tool';

export class TransferErc721Tool extends BaseTool {
  method = TRANSFER_ERC721_TOOL;
  name = 'Transfer ERC721';
  description: string;
  parameters: ReturnType<typeof transferERC721Parameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferERC721Prompt(context);
    this.parameters = transferERC721Parameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferERC721Parameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return await HederaParameterNormaliser.normaliseTransferERC721Params(
      params,
      ERC721_TRANSFER_FUNCTION_ABI,
      ERC721_TRANSFER_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.executeTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    if (context.mode === AgentMode.RETURN_BYTES) {
      return await handleTransaction(transaction, client, context);
    }
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const message =
      'Failed to transfer ERC721' + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_erc721_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new TransferErc721Tool(context);

export default tool;
