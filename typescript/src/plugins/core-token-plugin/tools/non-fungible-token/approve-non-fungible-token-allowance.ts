import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const APPROVE_NFT_ALLOWANCE_TOOL = 'approve_nft_allowance_tool';

export class ApproveNftAllowanceTool extends BaseTool {
  method = APPROVE_NFT_ALLOWANCE_TOOL;
  name = 'Approve NFT Allowance';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = approveNftAllowancePrompt(context);
    this.parameters = approveNftAllowanceParameters(context).innerType();
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof approveNftAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    return HederaParameterNormaliser.normaliseApproveNftAllowance(params, context, client);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.approveNftAllowance(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to Approve NFT allowance';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[approve_nft_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new ApproveNftAllowanceTool(context);

export default tool;
