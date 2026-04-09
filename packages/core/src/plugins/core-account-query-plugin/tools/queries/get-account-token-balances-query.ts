import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { accountTokenBalancesQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { Client } from '@hashgraph/sdk';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TokenBalancesResponse } from '@/shared/hedera-utils/mirrornode/types';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';

export const getAccountTokenBalancesQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the token balances for a given Hedera account. The human message will contain parsed balances in display units whereas the extra field will contain the raw token balances response from the mirror node with .

Parameters:
- ${accountDesc}
- tokenId (str, optional): The token ID to query for. If not provided, all token balances will be returned
${usageInstructions}
`;
};

const postProcess = (tokenBalances: TokenBalancesResponse, accountId: string) => {
  if (tokenBalances.tokens.length === 0) {
    return `No token balances found for account ${accountId}`;
  }
  const balancesText = tokenBalances.tokens
    .map(
      token =>
        ` Token: ${token.token_id}, Symbol: ${token.symbol}  Balance: ${toDisplayUnit(token.balance, token.decimals)}, Decimals: ${token.decimals}`,
    )
    .join('\n');

  return `Details for ${accountId}
--- Token Balances ---
${balancesText}

The token balances are returned in display units!
`;
};

export const GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL = 'get_account_token_balances_query_tool';

export class GetAccountTokenBalancesQueryTool extends BaseTool {
  method = GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL;
  name = 'Get Account Token Balances';
  description: string;
  parameters: ReturnType<typeof accountTokenBalancesQueryParameters>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getAccountTokenBalancesQueryPrompt(context);
    this.parameters = accountTokenBalancesQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseAccountTokenBalancesParams(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const tokenBalances = await mirrornodeService.getAccountTokenBalances(
      normalisedParams.accountId,
      normalisedParams.tokenId,
    );
    return {
      raw: {
        accountId: normalisedParams.accountId,
        tokenBalances: tokenBalances,
      },
      humanMessage: postProcess(tokenBalances, normalisedParams.accountId),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_request: any, _client: Client, _context: Context): Promise<any> {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to get account token balances';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_account_token_balances_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetAccountTokenBalancesQueryTool(context);

export default tool;
