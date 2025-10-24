import { Context, Tool, PromptGenerator, getMirrornodeService } from    "hedera-agent-kit";
import { z } from 'zod';
import type { Client } from "@hashgraph/sdk";
import { getSwapQuoteV2Parameters, getSwapQuoteV2ParametersNormalised } from "../saucer-swap.zod";
import { SaucerSwapV2QueryServiceImpl } from "../service/saucer-swap-v2-query-service-impl";
import SaucerSwapV2ParameterNormaliser from "../saucer-swap-v2-parameter-normaliser";
import { SaucerSwapV2ConfigService } from "../service/saucer-swap-v2-config-service";

const getSwapQuoteV2Prompt = (context: Context = {}) => {
    const contextSnippet = PromptGenerator.getContextSnippet(context);
    const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  
    return `
  ${contextSnippet}
  
  This tool will get a quote for swapping from tokenIn to tokenOut. Provide either optional.amountIn (exact-in) or optional.amountOut (exact-out).
  
  Parameters:
  - tokenIn (str, required): The input token address.
  - tokenOut (str, required): The output token address.
  - amountIn (number, required): The amount of input tokens to swap.
  ${usageInstructions}
  
  Example: "Get quote for swapping 1000000000000000000 amountIn from 0x1234567890abcdef1234567890abcdef12345678 tokenIn to 0xabcdef1234567890abcdef1234567890abcdef12345678 tokenOut"
  `;
  };

const postProcess = (quote: number, tokenAmountInBaseUnit: number, params: z.infer<ReturnType<typeof getSwapQuoteV2ParametersNormalised>>) => {
  return `Swapping ${tokenAmountInBaseUnit} token: ${params.tokenIn} to token: ${params.tokenOut} will result in ${quote} token: ${params.tokenOut}, the rate used is ${quote / tokenAmountInBaseUnit}`;
}

const getSwapQuoteV2 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof getSwapQuoteV2Parameters>>
) => {
  const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
  const saucerSwapV2ConfigService = new SaucerSwapV2ConfigService(client.ledgerId!);
  const saucerSwapV2QueryService = new SaucerSwapV2QueryServiceImpl(client.ledgerId!, mirrorNode, saucerSwapV2ConfigService);
  try {
    const normalisedParams = await SaucerSwapV2ParameterNormaliser.normaliseGetSwapQuoteV2Params(
      params,
      context,
      saucerSwapV2QueryService,
    );
    const quote = await saucerSwapV2QueryService.getSwapQuote(normalisedParams.tokenIn, normalisedParams.tokenOut, normalisedParams.amountIn);
    
    return {
      raw: { quote },
      humanMessage: postProcess(quote, normalisedParams.amountIn, normalisedParams),
    };
  } catch (error) {
    const desc = 'Failed to get quote';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_quote_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
}

export const GET_SWAP_QUOTE_V2_TOOL = "get_swap_quote_v2_tool" as const;

const tool = (context: Context): Tool => ({
  method: GET_SWAP_QUOTE_V2_TOOL,
  name: "Get Quote (SaucerSwap V2)",
  description: getSwapQuoteV2Prompt(context),
  parameters: getSwapQuoteV2Parameters(context),
  execute: getSwapQuoteV2,
});

export default tool;
