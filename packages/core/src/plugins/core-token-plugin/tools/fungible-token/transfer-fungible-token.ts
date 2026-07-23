import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import { Client } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  const senderDesc = PromptGenerator.getAccountParameterDescription('senderAccountId', context);

  return `
${contextSnippet}

Use this tool to transfer HTS fungible tokens that the sender **owns directly** — no allowance is involved.
The sender must hold the tokens in their own account. The tool signs the transfer with the sender's key.

DO NOT use this tool when:
- The user mentions "allowance", "approved", or "on behalf of"
- The user is spending tokens that belong to a different account via a pre-approved allowance

Use transfer_fungible_token_with_allowance_tool instead for allowance-based transfers.

Parameters:
- tokenId (string, required): The token ID to transfer (e.g. "0.0.12345")
- ${senderDesc}
- transfers (array of objects, required): List of token transfers. Each object should contain:
  - accountId (string, required): Recipient account ID
  - amount (number, required): Amount of tokens to transfer in display unit
- transactionMemo (string, optional): Optional memo for the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: Send 25 of my fungible tokens with id 0.0.33333 to 0.0.2002
Example 2: Transfer 50 TKN (token id: '0.0.33333') from my account to 0.0.2002 and 75 TKN to 0.0.3003
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled fungible token transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Fungible tokens successfully transferred.
Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_FUNGIBLE_TOKEN_TOOL = 'transfer_fungible_token_tool';

export class TransferFungibleTokenTool extends BaseTransactionTool {
  method = TRANSFER_FUNGIBLE_TOKEN_TOOL;
  name = 'Transfer Fungible Token';
  description: string;
  parameters: ReturnType<typeof transferFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferFungibleTokenPrompt(context);
    this.parameters = transferFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return HederaParameterNormaliser.normaliseTransferFungibleToken(
      params,
      context,
      client,
      mirrornode,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.transferFungibleToken(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context: Context): BaseTransactionTool => new TransferFungibleTokenTool(context);

export default tool;
