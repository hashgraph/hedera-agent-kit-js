import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client } from '@hashgraph/sdk';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import BigNumber from 'bignumber.js';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { toHbar } from '@/shared/hedera-utils/hbar-conversion-utils';

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

export const getHbarBalanceQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof accountBalanceQueryParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseHbarBalanceParams(
      params,
      context,
      client,
    );
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const balance: BigNumber = await mirrornodeService.getAccountHbarBalance(
      normalisedParams.accountId,
    );
    return {
      raw: { accountId: normalisedParams.accountId, hbarBalance: toHbar(balance).toString() },
      humanMessage: postProcess(toHbar(balance).toString() as string, normalisedParams.accountId),
    };
  } catch (error) {
    const desc = 'Failed to get HBAR balance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_hbar_balance_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_HBAR_BALANCE_QUERY_TOOL = 'get_hbar_balance_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_HBAR_BALANCE_QUERY_TOOL,
  name: 'Get HBAR Balance',
  description: getHbarBalanceQueryPrompt(context),
  parameters: accountBalanceQueryParameters(context),
  execute: getHbarBalanceQuery,
});

export default tool;
