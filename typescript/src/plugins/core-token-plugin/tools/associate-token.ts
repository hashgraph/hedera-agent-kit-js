import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
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

This tool will associate one or more tokens with a Hedera account.

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

export class AssociateTokenTool extends BaseTool {
  method = ASSOCIATE_TOKEN_TOOL;
  name = 'Associate Token(s)';
  description: string;
  parameters: z.ZodObject<any, any>;
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

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.associateToken(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to associate token(s)';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[associate_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new AssociateTokenTool(context);

export default tool;
