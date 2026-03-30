import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferNonFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool will transfer HTS non-fungible tokens (NFTs) from the operator's account to specified recipients.

Parameters:
- tokenId (string, required): The NFT token ID to transfer (e.g. "0.0.12345")
- recipients (array, required): List of objects specifying recipients and serial numbers - accepts multiple transfers at once
  - recipientId (string, required): Account to transfer to
  - serialNumber (number, required): NFT serial number to transfer
- transactionMemo (string, optional): Optional memo for the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
If multiple recipients are specified, the tool will create a single transaction for all transfers - they should be defined in recipients array.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled non-fungible token transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Non-fungible tokens successfully transferred. Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_NON_FUNGIBLE_TOKEN_TOOL = 'transfer_non_fungible_token_tool';

export class TransferNonFungibleTokenTool extends BaseTool {
  method = TRANSFER_NON_FUNGIBLE_TOKEN_TOOL;
  name = 'Transfer Non Fungible Token';
  description: string;
  parameters: ReturnType<typeof transferNonFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferNonFungibleTokenPrompt(context);
    this.parameters = transferNonFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseTransferNonFungibleToken(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.transferNonFungibleToken(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to transfer non-fungible token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_non_fungible_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new TransferNonFungibleTokenTool(context);

export default tool;
