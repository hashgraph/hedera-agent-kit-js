import { z } from 'zod';
import { Client, Status } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { BaseTool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { AccountResponse } from '@/shared/hedera-utils/mirrornode/types';
import { accountQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';

export const getAccountQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the account information for a given Hedera account.

Parameters:
- accountId (str, required): The account ID to query
${usageInstructions}
`;
};

const postProcess = (account: AccountResponse) => {
  return `Details for ${account.accountId}
Balance: ${account.balance.balance.toString()}
Public Key: ${account.accountPublicKey},
EVM address: ${account.evmAddress},
`;
};

export const GET_ACCOUNT_QUERY_TOOL = 'get_account_query_tool';

export class GetAccountQueryTool extends BaseTool {
  method = GET_ACCOUNT_QUERY_TOOL;
  name = 'Get Account Query';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getAccountQueryPrompt(context);
    this.parameters = accountQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof accountQueryParameters>>,
    _context: Context,
    _client: Client,
  ) {
    return params;
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const account = await mirrornodeService.getAccount(normalisedParams.accountId);
    return {
      raw: { accountId: normalisedParams.accountId, account: account },
      humanMessage: postProcess(account),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_request: any, _client: Client, _context: Context): Promise<any> {
    // No secondary action for queries
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to get account query';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_account_query_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetAccountQueryTool(context);

export default tool;
