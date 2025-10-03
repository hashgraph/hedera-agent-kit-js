import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { approveHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const approveHbarAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool approves an HBAR allowance from the owner to the spender.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- amount (number, required): Amount of HBAR to approve (can be decimal, cannot be negative)
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `HBAR allowance approved successfully. Transaction ID: ${response.transactionId}`;
};

const approveHbarAllowance = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>>,
) => {
  try {
    const normalisedParams = HederaParameterNormaliser.normaliseApproveHbarAllowance(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.approveHbarAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to approve hbar allowance.';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_hbar_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const APPROVE_HBAR_ALLOWANCE_TOOL = 'approve_hbar_allowance_tool';

const tool = (context: Context): Tool => ({
  method: APPROVE_HBAR_ALLOWANCE_TOOL,
  name: 'Approve HBAR Allowance',
  description: approveHbarAllowancePrompt(context),
  parameters: approveHbarAllowanceParameters(context),
  execute: approveHbarAllowance,
});

export default tool;
