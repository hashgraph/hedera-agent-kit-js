import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { dissociateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const dissociateTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will airdrop a fungible token on Hedera.

Parameters:
- tokenIds (array of strings, required): A list of Hedera token IDs to dissociate from the account. Example: ["0.0.1234", "0.0.5678"]
- ${sourceAccountDesc}, account from which to dissociate the token(s)
- transactionMemo (str, optional): Optional memo for the transaction

Examples:
- Dissociate a single token: { "tokenIds": ["0.0.1234"] }
- Dissociate multiple tokens from a specific account: { "tokenIds": ["0.0.1234", "0.0.5678"], "accountId": "0.0.4321" }

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token(s) successfully dissociated with transaction id ${response.transactionId.toString()}`;
};

const dissociateToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof dissociateTokenParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseDissociateTokenParams(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.dissociateToken(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to dissociate token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[dissociate_token_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const DISSOCIATE_TOKEN_TOOL = 'dissociate_token_tool';

const tool = (context: Context): Tool => ({
  method: DISSOCIATE_TOKEN_TOOL,
  name: 'Dissociate Token',
  description: dissociateTokenPrompt(context),
  parameters: dissociateTokenParameters(context),
  execute: dissociateToken,
});

export default tool;
