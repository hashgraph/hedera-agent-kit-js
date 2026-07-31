import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { airdropFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const airdropFungibleTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will airdrop a HTS fungible token on Hedera.

Parameters:
- tokenId (str, required): The id of the token
- ${sourceAccountDesc}
- recipients (array, required): A list of recipient objects (can contian a single recipient), each containing:
  - accountId (string, required): The recipient's account ID (e.g., "0.0.1234")
  - amount (number or string, required): The amount of tokens to send to that recipient (in display units)
- transactionMemo (str, optional): Optional memo for the transaction - not required for the tool call.
${usageInstructions}

If the user specifies multiple recipients in a single request, include them all in **one tool call** as a list of recipients.
User might want to airdrop to a single recipient.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token successfully airdropped with transaction id ${response.transactionId.toString()}`;
};

export const AIRDROP_FUNGIBLE_TOKEN_TOOL = 'airdrop_fungible_token_tool';

export class AirdropFungibleTokenTool extends BaseTransactionTool {
  method = AIRDROP_FUNGIBLE_TOKEN_TOOL;
  name = 'Airdrop Fungible Token';
  description: string;
  parameters: ReturnType<typeof airdropFungibleTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = airdropFungibleTokenPrompt(context);
    this.parameters = airdropFungibleTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return HederaParameterNormaliser.normaliseAirdropFungibleTokenParams(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.airdropFungibleToken(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context: Context): BaseTransactionTool => new AirdropFungibleTokenTool(context);

export default tool;
