import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { deleteNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const deleteNftAllowancePrompt = (context: Context = {}) => {
    const contextSnippet = PromptGenerator.getContextSnippet(context);
    const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
        'ownerAccountId',
        context,
    );
    const usageInstructions = PromptGenerator.getParameterUsageInstructions();

    return `
${contextSnippet}

This tool deletes NFT allowance(s) from the owner. Removing an allowance for a serial number means clearing the currently approved spender.

Parameters:
- ${ownerAccountDesc}
- tokenId (string, required): The ID of the NFT token.
- serialNumbers (number[], required): Array of serial numbers to remove allowance for.
- transactionMemo (string, optional): Optional memo for the transaction.
${usageInstructions}

Example: "Delete allowance for NFT 0.0.123 serials [1, 2]"
`;
};

const postProcess = (response: RawTransactionResponse) => {
    return `NFT allowance(s) deleted successfully. Transaction ID: ${response.transactionId}`;
};

const deleteNftAllowance = async (
    client: Client,
    context: Context,
    params: z.infer<ReturnType<typeof deleteNftAllowanceParameters>>,
) => {
    try {
        const normalisedParams = HederaParameterNormaliser.normaliseDeleteNftAllowance(
            params,
            context,
            client,
        );
        const tx = HederaBuilder.deleteNftAllowance(normalisedParams);

        return await handleTransaction(tx, client, context, postProcess);
    } catch (error) {
        const desc = 'Failed to delete NFT allowance';
        const message = desc + (error instanceof Error ? `: ${error.message}` : '');
        console.error('[delete_non_fungible_token_allowance_tool]', message);
        return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
    }
};

export const DELETE_NFT_ALLOWANCE_TOOL = 'delete_non_fungible_token_allowance_tool';

const tool = (context: Context): Tool => ({
    method: DELETE_NFT_ALLOWANCE_TOOL,
    name: 'Delete Non Fungible Token Allowance',
    description: deleteNftAllowancePrompt(context),
    parameters: deleteNftAllowanceParameters(context),
    execute: deleteNftAllowance,
    outputParser: transactionToolOutputParser,
});

export default tool;
