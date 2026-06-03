import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { optionalScheduledTransactionParams } from './common.zod';

export const swapExactTokensForTokensParameters = (context: Context = {}) =>
  optionalScheduledTransactionParams(context).extend({
    routerContractId: z
      .string()
      .describe(
        'The DEX router contract that exposes swapExactTokensForTokens. Accepts a Hedera id (e.g. "0.0.12345") or an EVM address.',
      ),
    path: z
      .array(z.string())
      .min(2)
      .describe(
        'Ordered swap route as token addresses, from the input token to the output token (e.g. ["0.0.111", "0.0.222"]). Each entry may be a Hedera id or an EVM address. Most pairs are a direct [tokenIn, tokenOut] route.',
      ),
    amountIn: z
      .string()
      .describe(
        'Exact amount of the input token to swap, expressed in the token\'s smallest unit (base units, no decimals) as an integer string.',
      ),
    amountOutMin: z
      .string()
      .describe(
        'Minimum amount of the output token to accept, in the output token\'s smallest unit. Acts as the slippage floor; the swap reverts if the result would be lower.',
      ),
    recipientAddress: z
      .string()
      .optional()
      .describe(
        'Address that receives the output tokens. Accepts a Hedera id or an EVM address. Defaults to the operator/connected account.',
      ),
    deadlineSeconds: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Unix timestamp (in seconds) after which the swap is no longer valid. Defaults to 20 minutes from now.',
      ),
    gas: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1_000_000)
      .describe('Gas limit for the router contract call.'),
  });
