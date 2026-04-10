import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { approveHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const APPROVE_HBAR_ALLOWANCE_TOOL = 'approve_hbar_allowance_tool';

export class ApproveHbarAllowanceTool extends BaseTool {
  method = APPROVE_HBAR_ALLOWANCE_TOOL;
  name = 'Approve HBAR Allowance';
  description: string;
  parameters: ReturnType<typeof approveHbarAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = approveHbarAllowancePrompt(context);
    this.parameters = approveHbarAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseApproveHbarAllowance(params, context, client);
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.approveHbarAllowance(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to approve hbar allowance.';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_hbar_allowance_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new ApproveHbarAllowanceTool(context);

export default tool;
