import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  ERC721_MINT_FUNCTION_ABI,
  ERC721_MINT_FUNCTION_NAME,
} from '@/shared/constants/contracts';
import { mintERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { assertEcdsaOperator } from '@/plugins/core-evm-plugin/utils/operator-key';

const mintERC721Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  const toAddressDesc = PromptGenerator.getAnyAddressParameterDescription(
    'toAddress',
    context,
    false,
  );

  return `
${contextSnippet}

This tool will mint (create a new token from existing contract) a new ERC721 token on Hedera. ERC721 is an EVM compatible non fungible token (NFT).
Use this only for EVM contract-based ERC721 minting.
Do NOT use this tool for HTS NFT mint requests that provide metadata URI/URIs for a Hedera token class (those belong to mint_non_fungible_token_tool).

Parameters:
- contractId (str, required): The id of the ERC721 contract
- ${toAddressDesc}
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Mint ERC721 token 0.0.6486793 to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means minting the ERC721 token with contract id 0.0.6486793 to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
Example: "Mint ERC721 token 0.0.6486793 to 0.0.6486793" means minting the ERC721 token with contract id 0.0.6486793 to the 0.0.6486793 Hedera account id.

NOTE: the 'toAddress' parameter is optional. If not provided, the minting will be performed to the default account as per the context.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled minting of ERC721 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC721 token minted successfully.
    Transaction ID: ${response.transactionId}`;

export const MINT_ERC721_TOOL = 'mint_erc721_tool';

export class MintErc721Tool extends BaseTransactionTool {
  method = MINT_ERC721_TOOL;
  name = 'Mint ERC721';
  description: string;
  parameters: ReturnType<typeof mintERC721Parameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = mintERC721Prompt(context);
    this.parameters = mintERC721Parameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof mintERC721Parameters>>,
    context: Context,
    client: Client,
  ) {
    assertEcdsaOperator(client);
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return await HederaParameterNormaliser.normaliseMintERC721Params(
      params,
      ERC721_MINT_FUNCTION_ABI,
      ERC721_MINT_FUNCTION_NAME,
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
}

const tool = (context: Context): BaseTransactionTool => new MintErc721Tool(context);

export default tool;
