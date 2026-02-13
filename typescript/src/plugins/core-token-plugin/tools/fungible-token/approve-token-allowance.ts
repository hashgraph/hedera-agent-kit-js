import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { approveTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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
  - amount (number): Amount of tokens to approve (must be a positive number, can be float or int). Given in display units, the tool will handle parsing
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Fungible token allowance(s) approved successfully. Transaction ID: ${response.transactionId}`;
};

export const APPROVE_TOKEN_ALLOWANCE_TOOL = 'approve_token_allowance_tool';

export class ApproveTokenAllowanceTool extends BaseTool {
  method = APPROVE_TOKEN_ALLOWANCE_TOOL;
  name = 'Approve Token Allowance';
  description: string;
  parameters: ReturnType<typeof approveTokenAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = approveTokenAllowancePrompt(context);
    this.parameters = approveTokenAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.approveTokenAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to approve token allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_token_allowance_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction.toString(), error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new ApproveTokenAllowanceTool(context);

export default tool;
