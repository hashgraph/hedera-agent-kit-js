import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { swapExactTokensForTokensParameters } from '@/shared/parameter-schemas/dex.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  DEX_SWAP_EXACT_TOKENS_FUNCTION_ABI,
  DEX_SWAP_EXACT_TOKENS_FUNCTION_NAME,
} from '@/shared/constants/contracts';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { assertEcdsaOperator } from '@/plugins/core-evm-plugin/utils/operator-key';

const swapTokensPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool swaps an exact amount of one token for another on a Hedera DEX by calling the router's swapExactTokensForTokens function. It works with any Uniswap V2 style router (e.g. SaucerSwap).

Important: the input token must already have an allowance granted to the router contract before swapping. Use the approve_token_allowance_tool first for HTS tokens.

Parameters:
- routerContractId (str, required): The DEX router contract. Can be a Hedera id (e.g. "0.0.12345") or an EVM address.
- path (string[], required): Ordered swap route as token addresses, from input token to output token (e.g. ["0.0.111", "0.0.222"]). Each entry may be a Hedera id or an EVM address.
- amountIn (str, required): Exact amount of the input token, in its smallest unit (base units), as an integer string.
- amountOutMin (str, required): Minimum acceptable output amount, in the output token's smallest unit. Acts as the slippage floor.
- recipientAddress (str, optional): Address that receives the output tokens. Defaults to the operator/connected account.
- deadlineSeconds (number, optional): Unix timestamp after which the swap is invalid. Defaults to 20 minutes from now.
- gas (number, optional): Gas limit for the router call. Defaults to 1,000,000.
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Swap 100000000 base units of token 0.0.111 for at least 95000000 base units of token 0.0.222 using router 0.0.12345" performs a swap along the [0.0.111, 0.0.222] route.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled token swap successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `Token swap submitted successfully.
Transaction ID: ${response.transactionId}`;

export const SWAP_TOKENS_TOOL = 'swap_tokens_tool';

export class SwapTokensTool extends BaseTool {
  method = SWAP_TOKENS_TOOL;
  name = 'Swap Tokens';
  description: string;
  parameters: ReturnType<typeof swapExactTokensForTokensParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = swapTokensPrompt(context);
    this.parameters = swapExactTokensForTokensParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof swapExactTokensForTokensParameters>>,
    context: Context,
    client: Client,
  ) {
    assertEcdsaOperator(client);
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return await HederaParameterNormaliser.normaliseSwapExactTokensForTokensParams(
      params,
      DEX_SWAP_EXACT_TOKENS_FUNCTION_ABI,
      DEX_SWAP_EXACT_TOKENS_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.executeTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    if (context.mode === AgentMode.RETURN_BYTES) {
      return await handleTransaction(transaction, client, context);
    }
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to swap tokens';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error(`[${SWAP_TOKENS_TOOL}]`, message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new SwapTokensTool(context);
export default tool;
