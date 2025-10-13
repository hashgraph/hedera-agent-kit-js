import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';

const transferHbarPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer HBAR to an account.

Parameters:
- transfers (array of objects, required): List of HBAR transfers. Each object should contain:
  - accountId (string): Recipient account ID
  - amount (number): Amount of HBAR to transfer
- ${sourceAccountDesc}
- transactionMemo (string, optional): Optional memo for the transfer HBAR transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled HBAR transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `HBAR successfully transferred.
Transaction ID: ${response.transactionId}`;
};

const transferHbar = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferHbarParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferHbar(
      params,
      context,
      client,
    );
    const tx = HederaBuilder.transferHbar(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer HBAR';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_HBAR_TOOL,
  name: 'Transfer HBAR',
  description: transferHbarPrompt(context),
  parameters: transferHbarParameters(context),
  execute: transferHbar,
});

export default tool;
