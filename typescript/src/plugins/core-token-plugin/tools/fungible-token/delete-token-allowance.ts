import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { deleteTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const deleteTokenAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const ownerAccountDesc = PromptGenerator.getAccountParameterDescription(
    'ownerAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool deletes HTS token allowance(s) from the owner to the spender.

Parameters:
- ${ownerAccountDesc}
- spenderAccountId (string, required): Spender account ID
- tokenIds (array, required): List of token IDs whose allowances should be removed
- transactionMemo (string, optional): Optional memo for the transaction
${usageInstructions}
Example: "Delete token allowance for account 0.0.123 on token 0.0.456". Means that 0.0.123 is the spenderId, 0.0.456 is the tokenId and the ownerId is taken from context or default operator.
Example 2: "Delete token allowance given from 0.0.1001 to account 0.0.2002 for token 0.0.3003". Means that 0.0.1001 is the ownerId, 0.0.2002 is the spenderId and 0.0.3003 is the tokenId.
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token allowance(s) deleted successfully. Transaction ID: ${response.transactionId}`;
};

export const DELETE_TOKEN_ALLOWANCE_TOOL = 'delete_token_allowance_tool';

export class DeleteTokenAllowanceTool extends BaseTool {
  method = DELETE_TOKEN_ALLOWANCE_TOOL;
  name = 'Delete Token Allowance';
  description: string;
  parameters: ReturnType<typeof deleteTokenAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = deleteTokenAllowancePrompt(context);
    this.parameters = deleteTokenAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof deleteTokenAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return HederaParameterNormaliser.normaliseDeleteTokenAllowance(
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
    const desc = 'Failed to delete token allowance(s).';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[delete_token_allowance_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new DeleteTokenAllowanceTool(context);

export default tool;
