import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferNonFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferNonFungibleTokenWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool will transfer HTS non-fungible tokens (NFTs) using an existing **token allowance**.

Parameters:
- sourceAccountId (string, required): The token owner (allowance granter)
- tokenId (string, required): The NFT token ID to transfer (e.g. "0.0.12345")
- recipients (array, required): List of objects specifying recipients and serial numbers - accepts multiple transfers at once
  - recipientId (string, required): Account to transfer to
  - serialNumber (string, required): NFT serial number to transfer
- transactionMemo (string, optional): Optional memo for the transaction

${usageInstructions}

If multiple recipients are specified, the tool will create a single transaction for all transfers - they should be defined in recipients array.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Non-fungible tokens successfully transferred with allowance. Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
  'transfer_non_fungible_token_with_allowance_tool';

export class TransferNonFungibleTokenWithAllowanceTool extends BaseTool {
  method = TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL;
  name = 'Transfer Non Fungible Token with Allowance';
  description: string;
  parameters: ReturnType<typeof transferNonFungibleTokenWithAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferNonFungibleTokenWithAllowancePrompt(context);
    this.parameters = transferNonFungibleTokenWithAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParameters>>,
    context: Context,
    _client: Client,
  ) {
    return HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(
      params,
      context,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.transferNonFungibleTokenWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to transfer non-fungible token with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_non_fungible_token_with_allowance_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new TransferNonFungibleTokenWithAllowanceTool(context);

export default tool;
