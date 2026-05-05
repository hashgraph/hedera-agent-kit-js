import { z } from 'zod';
import BigNumber from 'bignumber.js';
import { Client, Status } from '@hiero-ledger/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { BaseTool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { accountQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { toHbar } from '@/shared/hedera-utils/hbar-conversion-utils';

export const getAccountQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the account information for a given Hedera account. The returned account will contain the balance in HBAR, public key, and EVM address.

Parameters:
- accountId (str, required): The account ID to query
${usageInstructions}
`;
};

const postProcess = (account: any) => {
  return `Details for ${account.accountId}
Balance: ${account.balance.balance} HBAR
Public Key: ${account.accountPublicKey},
EVM address: ${account.evmAddress},
Ethereum nonce: ${account.ethereumNonce},
Created timestamp: ${account.createdTimestamp},
Memo: ${account.memo},
Max automatic token associations: ${account.maxAutomaticTokenAssociations},
Deleted: ${account.deleted},
`;
};

export const GET_ACCOUNT_QUERY_TOOL = 'get_account_query_tool';

export class GetAccountQueryTool extends BaseTool {
  method = GET_ACCOUNT_QUERY_TOOL;
  name = 'Get Account Query';
  description: string;
  parameters: ReturnType<typeof accountQueryParameters>;
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

    const hbarBalance = toHbar(new BigNumber(account.balance.balance)).toString();
    const accountWithHbar = {
      ...account,
      balance: {
        ...account.balance,
        balance: hbarBalance,
      },
      hbarBalance,
    };
    return {
      raw: { accountId: normalisedParams.accountId, account: accountWithHbar },
      humanMessage: postProcess(accountWithHbar),
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
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new GetAccountQueryTool(context);

export default tool;
