import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { ExchangeRateResponse } from '@/shared/hedera-utils/mirrornode/types';
import { exchangeRateQueryParameters } from '@/shared/parameter-schemas/core-misc.zod';

export const getExchangeRatePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool returns the Hedera network HBAR exchange rate from the Mirror Node.

Parameters:
- timestamp (str, optional): Historical timestamp to query. Pass seconds or nanos since epoch (e.g., 1726000000.123456789). If omitted, returns the latest rate.
${usageInstructions}
`;
};

const calculateUsdPerHBAR = (cent_equivalent: number, hbar_equivalent: number) => {
  return cent_equivalent / 100 / hbar_equivalent;
};

const postProcess = (rates: ExchangeRateResponse) => {
  const { current_rate, next_rate, timestamp } = rates;

  const usdPerHBAR = calculateUsdPerHBAR(
    current_rate.cent_equivalent,
    current_rate.hbar_equivalent,
  );
  const nextUsdPerHBAR = calculateUsdPerHBAR(next_rate.cent_equivalent, next_rate.hbar_equivalent);

  return `
  Details for timestamp: ${timestamp}
  
  Current exchange rate: ${usdPerHBAR}
  Expires at ${new Date(current_rate.expiration_time * 1000).toISOString()})
  
  Next exchange rate: ${nextUsdPerHBAR}
  Expires at ${new Date(next_rate.expiration_time * 1000).toISOString()})`;
};

export const getExchangeRateQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof exchangeRateQueryParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const rates: ExchangeRateResponse = await mirrornodeService.getExchangeRate(params.timestamp);
    return {
      raw: rates,
      humanMessage: postProcess(rates),
    };
  } catch (error) {
    console.error('[GetExchangeRate] Error getting exchange rate', error);
    const message = error instanceof Error ? error.message : 'Failed to get exchange rate';

    return {
      raw: { error: message },
      humanMessage: message,
    };
  }
};

export const GET_EXCHANGE_RATE_TOOL = 'get_exchange_rate_tool';

const tool = (context: Context): Tool => ({
  method: GET_EXCHANGE_RATE_TOOL,
  name: 'Get Exchange Rate',
  description: getExchangeRatePrompt(context),
  parameters: exchangeRateQueryParameters(context),
  execute: getExchangeRateQuery,
});

export default tool;
