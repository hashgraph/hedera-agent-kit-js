import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { associateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const associateTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  const accountToAssociate = PromptGenerator.getAnyAddressParameterDescription('accountId', context);

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

const associateToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof associateTokenParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseAssociateTokenParams(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.associateToken(normalisedParams);
    const result = await handleTransaction(tx, client, context, postProcess);
    return result;
  } catch (error) {
    const desc = 'Failed to associate token(s)';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[associate_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const ASSOCIATE_TOKEN_TOOL = 'associate_token_tool';

const tool = (context: Context): Tool => ({
  method: ASSOCIATE_TOKEN_TOOL,
  name: 'Associate Token(s)',
  description: associateTokenPrompt(context),
  parameters: associateTokenParameters(context),
  execute: associateToken,
});

export default tool;


