import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const approveNftAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool approves an NFT allowance from the owner to the spender for specific NFT serial numbers of a token, or for all serials in the NFT collection.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- tokenId (string, required): The NFT token ID (e.g., 0.0.xxxxx)
- allSerials (boolean, optional): If true, approves allowance for all current and future serials of the NFT. When true, do not provide serialNumbers.
- serialNumbers (number[], conditionally required): Array of NFT serial numbers to approve. Required when allSerials is not true.
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `NFT allowance approved successfully. Transaction ID: ${response.transactionId}`;
};

const approveNftAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof approveNftAllowanceParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseApproveNftAllowance(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.approveNftAllowance(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to Approve NFT allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_nft_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const APPROVE_NFT_ALLOWANCE_TOOL = 'approve_nft_allowance_tool';

const tool = (context: Context): Tool => ({
  method: APPROVE_NFT_ALLOWANCE_TOOL,
  name: 'Approve NFT Allowance',
  description: approveNftAllowancePrompt(context),
  parameters: approveNftAllowanceParameters(context).innerType(),
  execute: approveNftAllowance,
});

export default tool;
