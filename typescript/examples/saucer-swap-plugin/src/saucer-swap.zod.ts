import { z } from "zod";
import type { Context } from "hedera-agent-kit";


export const getSwapQuoteV2Parameters = (context: Context) => z.object({
  tokenIn: z.string().describe("Input token address"),
  tokenOut: z.string().describe("Output token address"),
  amountIn: z.number().describe("Amount of input tokens to swap"),
});

export const getSwapQuoteV2ParametersNormalised = (context: Context) => z.object({
  tokenIn: z.string().describe("Input token address"),
  tokenOut: z.string().describe("Output token address"),
  amountIn: z.number().describe("Amount of input tokens to swap"),
});

export const swapV2Parameters = (context: Context) => z.object({
  tokenIn: z.string().describe("Input token address"),
  tokenOut: z.string().describe("Output token address"),
  amountIn: z.number().describe("Amount of input tokens to swap"),
  recipientAddress: z.string().optional().describe("Recipient address"),
});
