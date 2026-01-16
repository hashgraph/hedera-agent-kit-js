import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client } from '@hashgraph/sdk';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import BigNumber from 'bignumber.js';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { toHbar } from '@/shared/hedera-utils/hbar-conversion-utils';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';

export const getHbarBalanceQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the HBAR balance for a given Hedera account.

Parameters:
- ${accountDesc}
${usageInstructions}
`;
};

const postProcess = (hbarBalance: string, accountId: string) => {
  return `Account ${accountId} has a balance of ${hbarBalance} HBAR`;
};

export const GET_HBAR_BALANCE_QUERY_TOOL = 'get_hbar_balance_query_tool';

export class GetHbarBalanceQueryTool extends BaseTool {
  method = GET_HBAR_BALANCE_QUERY_TOOL;
  name = 'Get HBAR Balance';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getHbarBalanceQueryPrompt(context);
    this.parameters = accountBalanceQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof accountBalanceQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseHbarBalanceParams(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const balance: BigNumber = await mirrornodeService.getAccountHbarBalance(
      normalisedParams.accountId,
    );
    return {
      raw: { accountId: normalisedParams.accountId, hbarBalance: toHbar(balance).toString() },
      humanMessage: postProcess(toHbar(balance).toString() as string, normalisedParams.accountId),
    };
  }

  async shouldSecondaryAction(request: any, context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(request: any, client: Client, context: Context) {
    return request;
  }

  async handleError(error: unknown, context: Context): Promise<any> {
    const desc = 'Failed to get HBAR balance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_hbar_balance_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetHbarBalanceQueryTool(context);

export default tool;
