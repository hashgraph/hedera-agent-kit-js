import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { approveTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

const approveTokenAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool approves allowances for one or more fungible tokens from the owner to the spender.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- tokenApprovals (array, required): List of approvals. Each item:
  - tokenId (string): Token ID
  - amount (number): Amount of tokens to approve (must be a positive integer)
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Fungible token allowance(s) approved successfully. Transaction ID: ${response.transactionId}`;
};

const approveTokenAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params,
      context,
      client,
      mirrornodeService,
    );

    const tx = HederaBuilder.approveTokenAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to approve token allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_token_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const APPROVE_TOKEN_ALLOWANCE_TOOL = 'approve_token_allowance_tool';

const tool = (context: Context): Tool => ({
  method: APPROVE_TOKEN_ALLOWANCE_TOOL,
  name: 'Approve Token Allowance',
  description: approveTokenAllowancePrompt(context),
  parameters: approveTokenAllowanceParameters(context),
  execute: approveTokenAllowance,
});

export default tool;
