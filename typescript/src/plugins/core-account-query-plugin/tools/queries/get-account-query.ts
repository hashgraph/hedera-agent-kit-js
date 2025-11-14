import { z } from 'zod';
import { Client, Status } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { AccountResponse } from '@/shared/hedera-utils/mirrornode/types';
import { accountQueryParameters } from '@/shared/parameter-schemas/account.zod';

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
    const desc = 'Failed to get account query';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_account_query_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const GET_ACCOUNT_QUERY_TOOL = 'get_account_query_tool';

/**
 * Parses the stringified JSON output from the 'getAccountQuery' tool.
 * This is a custom parser for this specific query tool.
 * @param output The stringified JSON from the ToolMessage content.
 * @returns A JavaScript object with 'raw' and 'humanMessage' keys.
 */
const outputParser = (output: string): { raw: any; humanMessage: string } => {
  let parsedObject;
  try {
    parsedObject = JSON.parse(output);
  } catch (error) {
    console.error(`[${GET_ACCOUNT_QUERY_TOOL}] outputParser failed to parse JSON:`, error);
    return {
      raw: { status: 'PARSE_ERROR', error: error, originalOutput: output },
      humanMessage: 'Error: Failed to parse tool output. The output was malformed.'
    };
  }

  // Check for the SUCCESS case (identified by the 'account' key in 'raw')
  if (parsedObject && parsedObject.raw && parsedObject.raw.account) {
    return {
      raw: parsedObject.raw, // Contains { accountId, account }
      humanMessage: parsedObject.humanMessage
    };
  }

  // Check for the known FAILURE case (identified by the 'error' key in 'raw')
  if (parsedObject && parsedObject.raw && parsedObject.raw.error) {
    return {
      raw: parsedObject.raw, // Contains { status, error }
      humanMessage: parsedObject.humanMessage || 'An error occurred while fetching account data.'
    };
  }

  // Fallback for valid JSON but an unknown structure
  console.error(`[${GET_ACCOUNT_QUERY_TOOL}] outputParser received unknown JSON structure:`, parsedObject);
  return {
    raw: { status: 'PARSE_ERROR', error: 'Unknown JSON structure', originalOutput: output },
    humanMessage: 'Error: Tool output had an unexpected format.'
  };
};

const tool = (context: Context): Tool => ({
  method: GET_ACCOUNT_QUERY_TOOL,
  name: 'Get Account Query',
  description: getAccountQueryPrompt(context),
  parameters: accountQueryParameters(context),
  execute: getAccountQuery,
  outputParser: outputParser,
});

export default tool;
