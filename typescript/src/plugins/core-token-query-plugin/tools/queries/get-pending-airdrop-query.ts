import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { Client } from '@hashgraph/sdk';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import {
  TokenAirdropsResponse,
  TokenAirdrop,
  TokenInfo,
} from '@/shared/hedera-utils/mirrornode/types';
import { pendingAirdropQueryParameters } from '@/shared/parameter-schemas/token.zod';
import { AccountResolver } from '@/shared/utils/account-resolver';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { IHederaMirrornodeService } from '@/shared';
import BigNumber from 'bignumber.js';

export const getPendingAirdropQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return pending airdrops for a given Hedera account.

Parameters:
- ${accountDesc}
${usageInstructions}
`;
};

interface EnrichedTokenAirdrop extends TokenAirdrop {
  decimals: number;
  symbol: string;
}

interface EnrichedTokenAirdropsResponse {
  airdrops: EnrichedTokenAirdrop[];
}

const enrichSingleAirdrop = async (
  airdrop: TokenAirdrop,
  mirrornodeService: IHederaMirrornodeService,
): Promise<EnrichedTokenAirdrop> => {
  const enriched = airdrop as EnrichedTokenAirdrop;
  const tokenId = airdrop.token_id;

  // Default values
  let decimals = 0;
  let symbol = 'N/A';

  if (tokenId) {
    try {
      const info: TokenInfo = await mirrornodeService.getTokenInfo(tokenId);
      decimals = Number(info.decimals) ?? 0;
      symbol = info.symbol ?? 'N/A';
    } catch {
      symbol = 'UNKNOWN';
    }
  }

  enriched.decimals = decimals;
  enriched.symbol = symbol;

  return enriched;
};

const postProcess = (accountId: string, enrichedAirdrops: EnrichedTokenAirdrop[]) => {
  const count = enrichedAirdrops.length;

  if (count === 0) {
    return `No pending airdrops found for account ${accountId}`;
  }

  const details = enrichedAirdrops.map(airdrop => {
    const symbol = airdrop.symbol;
    const decimals = airdrop.decimals;
    const serialNumber = airdrop.serial_number;

    if (serialNumber) {
      return `- **${symbol}** #${serialNumber}`;
    } else {
      const amount = new BigNumber(airdrop.amount ?? 0);
      const displayAmount = toDisplayUnit(amount, decimals);
      return `- ${displayAmount.toFixed(decimals)} **${symbol}**`;
    }
  });

  const detailsStr = details.join('\n');
  return `Here are the pending airdrops for account **${accountId}** (total: ${count}):\n\n${detailsStr}`;
};

export const getPendingAirdropQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof pendingAirdropQueryParameters>>,
) => {
  try {
    const accountId = params.accountId ?? AccountResolver.getDefaultAccount(context, client);
    if (!accountId) throw new Error('Account ID is required and was not provided');

    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);

    // 1. Fetch the list of pending airdrops
    const response: TokenAirdropsResponse = await mirrornodeService.getPendingAirdrops(accountId);

    // 2. Parallel Fetch & Enrich
    const rawAirdrops = response.airdrops ?? [];
    const enrichedAirdrops = await Promise.all(
      rawAirdrops.map(airdrop => enrichSingleAirdrop(airdrop, mirrornodeService)),
    );

    // 3. Return response
    const enrichedResponse: EnrichedTokenAirdropsResponse = {
      airdrops: enrichedAirdrops,
    };

    return {
      raw: { accountId, pendingAirdrops: enrichedResponse },
      humanMessage: postProcess(accountId, enrichedAirdrops),
    };
  } catch (error) {
    const desc = 'Failed to get pending airdrops';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_pending_airdrop_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_PENDING_AIRDROP_TOOL = 'get_pending_airdrop_tool';

const tool = (context: Context): Tool => ({
  method: GET_PENDING_AIRDROP_TOOL,
  name: 'Get Pending Airdrops',
  description: getPendingAirdropQueryPrompt(context),
  parameters: pendingAirdropQueryParameters(context),
  execute: getPendingAirdropQuery,
  outputParser: untypedQueryOutputParser,
});

export default tool;
