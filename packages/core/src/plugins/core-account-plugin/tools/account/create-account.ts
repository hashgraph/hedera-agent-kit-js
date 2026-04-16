import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hiero-ledger/sdk';
import {
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { createAccountParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const createAccountPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will create a new Hedera account with a passed public key. If not passed, the tool will use operator's public key.

IMPORTANT: All parameters are optional. If the user does not explicitly provide optional parameters, proceed immediately using the default values. Do NOT ask the user for optional parameters.

NOTE: On Hedera, multiple accounts can be created and controlled using the same key pair (e.g., the operator account's key). This means that assets on the newly created account will be accessible using the same key pair as the operator account if no explicit public key is provided.
CRITICAL: Do NOT tell the user that you have generated a new key pair. This tool CANNOT generate a new key pair.
WARNING: If no public key is provided, the operator's key will be used. 

Parameters:
- publicKey (string, optional): Public key to use for the account. If not provided, the tool will use the operator's public key.
- accountMemo (string, optional): Optional memo for the account. Max 100 chars. Length will be validated in tool call.
- initialBalance (number, optional, default 0): Initial HBAR to fund the account
- maxAutomaticTokenAssociations (number, optional, default -1): -1 means unlimited
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled transaction created successfully.\nTransaction ID: ${response.transactionId}\nSchedule ID: ${response.scheduleId.toString()}\n`;
  }
  const accountIdStr = response.accountId ? response.accountId.toString() : 'unknown';
  return `Account created successfully.\nTransaction ID: ${response.transactionId}\nNew Account ID: ${accountIdStr}\n`;
};

export const CREATE_ACCOUNT_TOOL = 'create_account_tool';

export class CreateAccountTool extends BaseTool {
  method = CREATE_ACCOUNT_TOOL;
  name = 'Create Account';
  description: string;
  parameters: ReturnType<typeof createAccountParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = createAccountPrompt(context);
    this.parameters = createAccountParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof createAccountParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    return await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      client,
      mirrornodeService,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.createAccount(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to create account';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_account_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new CreateAccountTool(context);

export default tool;
