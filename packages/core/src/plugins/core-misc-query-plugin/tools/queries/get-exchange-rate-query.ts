import { z } from 'zod';
import { Client } from '@hiero-ledger/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { BaseTool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { ExchangeRateResponse } from '@/shared/hedera-utils/mirrornode/types';
import { exchangeRateQueryParameters } from '@/shared/parameter-schemas/core-misc.zod';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

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

export const GET_EXCHANGE_RATE_TOOL = 'get_exchange_rate_tool';

export class GetExchangeRateQueryTool extends BaseTool {
  method = GET_EXCHANGE_RATE_TOOL;
  name = 'Get Exchange Rate';
  description: string;
  parameters: ReturnType<typeof exchangeRateQueryParameters>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getExchangeRatePrompt(context);
    this.parameters = exchangeRateQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof exchangeRateQueryParameters>>,
    context: Context,
    _client: Client,
  ) {
    return HederaParameterNormaliser.parseParamsWithSchema(
      params,
      exchangeRateQueryParameters,
      context,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const rates: ExchangeRateResponse = await mirrornodeService.getExchangeRate(
      normalisedParams.timestamp,
    );
    return {
      raw: rates,
      humanMessage: postProcess(rates),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null; // Not applicable for query tools
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    console.error('[GetExchangeRate] Error getting exchange rate', error);
    const message = error instanceof Error ? error.message : 'Failed to get exchange rate';

    return {
      raw: { error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new GetExchangeRateQueryTool(context);

export default tool;
