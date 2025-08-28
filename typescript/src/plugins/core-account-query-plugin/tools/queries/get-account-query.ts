import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { accountQueryParameters } from '@/shared/parameter-schemas/query.zod';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { AccountResponse } from '@/shared/hedera-utils/mirrornode/types';

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

export const getAccountQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof accountQueryParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const account = await mirrornodeService.getAccount(params.accountId);
    return {
      raw: { accountId: params.accountId, account: account },
      humanMessage: postProcess(account),
    };
  } catch (error) {
    console.error('Error getting account query', error);
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to get account query';
  }
};

export const GET_ACCOUNT_QUERY_TOOL = 'get_account_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_ACCOUNT_QUERY_TOOL,
  name: 'Get Account Query',
  description: getAccountQueryPrompt(context),
  parameters: accountQueryParameters(context),
  execute: getAccountQuery,
});

export default tool;
