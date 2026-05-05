import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferFungibleTokenWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer a HTS fungible token using an existing **token allowance**.

Parameters:
- tokenId (string, required): The token ID to transfer (e.g. "0.0.12345")
- sourceAccountId (string, required): Account ID of the token owner (the allowance granter)
- transfers (array of objects, required): List of token transfers. Each object should contain:
  - accountId (string, required): Recipient account ID
  - amount (number, required): Amount of tokens to transfer in display unit
- transactionMemo (string, optional): Optional memo for the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: Spend allowance from account 0.0.1002 to send 25 fungible tokens with id 0.0.33333 to 0.0.2002
Example 2: Use allowance from 0.0.1002 to send 50 TKN (FT token id: '0.0.33333') to 0.0.2002 and 75 TKN to 0.0.3003
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled allowance transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Fungible tokens successfully transferred with allowance.
Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
  'transfer_fungible_token_with_allowance_tool';

export class TransferFungibleTokenWithAllowanceTool extends BaseTool {
  method = TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL;
  name = 'Transfer Fungible Token with Allowance';
  description: string;
  parameters: ReturnType<typeof transferFungibleTokenWithAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferFungibleTokenWithAllowancePrompt(context);
    this.parameters = transferFungibleTokenWithAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
      params,
      context,
      client,
      mirrornode,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.transferFungibleTokenWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to transfer fungible token with allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_fungible_token_with_allowance_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new TransferFungibleTokenWithAllowanceTool(context);

export default tool;
