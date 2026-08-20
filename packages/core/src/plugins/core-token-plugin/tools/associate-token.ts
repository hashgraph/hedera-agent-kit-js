import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { associateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const associateTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  const accountToAssociate = PromptGenerator.getAnyAddressParameterDescription(
    'accountId',
    context,
  );

  return `
${contextSnippet}

This tool will associate one or more HTS tokens with a Hedera account.

Parameters:
${accountToAssociate}
- tokenIds (string[], required): Array of token IDs to associate
${usageInstructions}

Example: "Associate tokens 0.0.123 and 0.0.456 to account 0.0.789".
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Tokens successfully associated with transaction id ${response.transactionId.toString()}`;
};

export const ASSOCIATE_TOKEN_TOOL = 'associate_token_tool';

export class AssociateTokenTool extends BaseTransactionTool {
  method = ASSOCIATE_TOKEN_TOOL;
  name = 'Associate Token(s)';
  description: string;
  parameters: ReturnType<typeof associateTokenParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = associateTokenPrompt(context);
    this.parameters = associateTokenParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof associateTokenParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseAssociateTokenParams(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.associateToken(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context: Context): BaseTransactionTool => new AssociateTokenTool(context);

export default tool;
