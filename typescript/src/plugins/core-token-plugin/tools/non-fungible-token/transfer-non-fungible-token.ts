import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferNonFungibleTokenPrompt = (context: Context = {}) => {
    const contextSnippet = PromptGenerator.getContextSnippet(context);
    const usageInstructions = PromptGenerator.getParameterUsageInstructions();

    return `
${contextSnippet}
This tool will transfer non-fungible tokens (NFTs) from the operator's account to specified recipients.

Parameters:
- tokenId (string, required): The NFT token ID to transfer (e.g. "0.0.12345")
- recipients (array, required): List of objects specifying recipients and serial numbers
  - recipientId (string): Account to transfer to
  - serialNumber (number): NFT serial number to transfer
- transactionMemo (string, optional): Optional memo for the transaction

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
    return `Non-fungible tokens successfully transferred. Transaction ID: ${response.transactionId}`;
};

const transferNonFungibleToken = async (
    client: Client,
    context: Context,
    params: z.infer<ReturnType<typeof transferNonFungibleTokenParameters>>,
) => {
    try {
        const normalisedParams = HederaParameterNormaliser.normaliseTransferNonFungibleToken(
            params,
            context,
            client,
        );

        const tx = HederaBuilder.transferNonFungibleToken(normalisedParams);
        return await handleTransaction(tx, client, context, postProcess);
    } catch (error) {
        const desc = 'Failed to transfer non-fungible token';
        const message = desc + (error instanceof Error ? `: ${error.message}` : '');
        console.error('[transfer_non_fungible_token_tool]', message);
        return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
    }
};

export const TRANSFER_NON_FUNGIBLE_TOKEN_TOOL = 'transfer_non_fungible_token_tool';

const tool = (context: Context): Tool => ({
    method: TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
    name: 'Transfer Non Fungible Token',
    description: transferNonFungibleTokenPrompt(context),
    parameters: transferNonFungibleTokenParameters(context).innerType(),
    execute: transferNonFungibleToken,
    outputParser: transactionToolOutputParser,
});

export default tool;
