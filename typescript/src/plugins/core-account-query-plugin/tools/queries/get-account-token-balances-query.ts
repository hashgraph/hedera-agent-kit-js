import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { accountTokenBalancesQueryParameters } from '@/shared/parameter-schemas/query.zod';
import { Client } from '@hashgraph/sdk';
import { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TokenBalancesResponse } from '@/shared/hedera-utils/mirrornode/types';

export const getAccountTokenBalancesQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the token balances for a given Hedera account.

Parameters:
- ${accountDesc}
- tokenId (str, optional): The token ID to query for. If not provided, all token balances will be returned
${usageInstructions}
`;
};

const postProcess = (tokenBalances: TokenBalancesResponse, accountId: string) => {
  const balancesText = tokenBalances.tokens
    .map(
      token => `  Token: ${token.token_id}, Balance: ${token.balance}, Decimals: ${token.decimals}`,
    )
    .join('\n');

  return `Details for ${accountId}
--- Token Balances ---
${balancesText}`;
};

export const getAccountTokenBalancesQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseAccountTokenBalancesParams(
      params,
      context,
      client,
    );
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const tokenBalances = await mirrornodeService.getAccountTokenBalances(
      normalisedParams.accountId,
      normalisedParams.tokenId,
    );
    return {
      raw: { accountId: normalisedParams.accountId, tokenBalances: tokenBalances },
      humanMessage: postProcess(tokenBalances, normalisedParams.accountId),
    };
  } catch (error) {
    console.error('Error getting account token balances', error);
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to get account token balances';
  }
};

export const GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL = 'get_account_token_balances_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  name: 'Get Account Token Balances',
  description: getAccountTokenBalancesQueryPrompt(context),
  parameters: accountTokenBalancesQueryParameters(context),
  execute: getAccountTokenBalancesQuery,
});

export default tool;
