import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { optionalScheduledTransactionParams } from './common.zod';

/**
 * A token amount in base units.
 *
 * These values are fed straight into `BigInt()` by the normaliser, and an LLM
 * routinely produces `"1.5"` or `"1e10"` when it ignores the "base units"
 * instruction — both of which throw a raw `SyntaxError` deep in normalisation
 * instead of surfacing a usable validation error. The regex rejects them at the
 * schema boundary. It also rejects `""`, which `BigInt()` silently coerces to
 * `0`, and negative values.
 */
const baseUnitAmount = (field: string) =>
  z
    .string()
    .regex(
      /^\d+$/,
      `${field} must be an integer string in the token's smallest unit (base units) — no decimals, sign, or exponent`,
    )
    // Both checks are plain string checks on purpose. A `.refine()` calling
    // BigInt() would throw on inputs the regex already rejected: zod runs
    // refinements even after a preceding regex check fails.
    .regex(/^(?!0+$)/, `${field} must be greater than zero`);

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
    amountIn: baseUnitAmount('amountIn').describe(
      "Exact amount of the input token to swap, expressed in the token's smallest unit (base units, no decimals) as a positive integer string.",
    ),
    // Must stay strictly positive: this is the slippage floor, and a zero floor
    // accepts any output amount, leaving the swap open to sandwiching.
    amountOutMin: baseUnitAmount('amountOutMin').describe(
      "Minimum amount of the output token to accept, in the output token's smallest unit, as a positive integer string. Acts as the slippage floor; the swap reverts if the result would be lower. Must be greater than zero — a zero floor would accept any output amount.",
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
