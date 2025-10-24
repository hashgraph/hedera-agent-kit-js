import SaucerSwapV2ParameterNormaliser from "../saucer-swap-v2-parameter-normaliser";
import { swapV2Parameters } from "../saucer-swap.zod";
import { Context, getMirrornodeService, handleTransaction, HederaBuilder, PromptGenerator, RawTransactionResponse, Tool } from "hedera-agent-kit";
import { z } from "zod";
import { Client, Status } from "@hashgraph/sdk";
import { SaucerSwapV2ConfigService } from "../service/saucer-swap-v2-config-service";
import { SaucerSwapV2QueryServiceImpl } from "../service/saucer-swap-v2-query-service-impl";

const swapV2Prompt = (context: Context = {}) => {
    return `
    ${PromptGenerator.getContextSnippet(context)}

    This tool will swap tokens using the SaucerSwap V2 protocol.

    Parameters:
    - tokenIn (str, required): The input token address
    - tokenOut (str, required): The output token address
    - amountIn (number, required): The amount of input tokens to swap
    - recipientAddress (str, required): The address to receive the output tokens
    `;
}

const postProcess = (response: RawTransactionResponse) => {
    return `
    Swap successful.
    Transaction ID: ${response.transactionId}
    `;   
}

const swapV2 = async (
    client: Client,
    context: Context,
    params: z.infer<ReturnType<typeof swapV2Parameters>>
) => {
    try {   
        const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
        const saucerSwapV2ConfigService = new SaucerSwapV2ConfigService(client.ledgerId!);
        const saucerSwapV2QueryService = new SaucerSwapV2QueryServiceImpl(client.ledgerId!, mirrorNode, saucerSwapV2ConfigService);
        const normalisedParams = await SaucerSwapV2ParameterNormaliser.normaliseSwapV2Params(params, context, saucerSwapV2ConfigService, saucerSwapV2QueryService, mirrorNode, client);
        const modifiedParams = { ...normalisedParams, gas: normalisedParams.gas };
        const tx = HederaBuilder.executeTransaction(modifiedParams);
        return handleTransaction(tx, client, context, postProcess);
    } catch (error) {
        console.error('error', error);
        const desc = 'Failed to swap tokens';
        const message = desc + (error instanceof Error ? `: ${error.message}` : '');
        console.error('[swap_v2_tool]', message);
        return { 
            raw: { 
                status: Status.InvalidTransaction.toString(), 
                accountId: null,
                tokenId: null,
                transactionId: '',
                topicId: null,
                scheduleId: null,
                error: message 
            }, 
            humanMessage: message 
        };
    }
}

export const SWAP_V2_TOOL = 'swap_v2_tool';

const tool = (context: Context): Tool => ({
    method: SWAP_V2_TOOL,
    name: 'Swap V2',
    description: swapV2Prompt(context),
    parameters: swapV2Parameters(context),
    execute: swapV2,
});

export default tool;