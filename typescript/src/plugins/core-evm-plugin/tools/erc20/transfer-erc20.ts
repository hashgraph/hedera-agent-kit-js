import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { transferERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  ERC20_TRANSFER_FUNCTION_ABI,
  ERC20_TRANSFER_FUNCTION_NAME,
} from '@/shared/constants/contracts';

const transferERC20Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer a given amount of an existing ERC20 token on Hedera. ERC20 is an EVM compatible fungible token.

Parameters:
- contractId (str, required): The id of the ERC20 contract. This can be the EVM address or the Hedera account id.
- recipientAddress (str, required): The EVM or Hedera address to which the tokens will be transferred. This can be the EVM address or the Hedera account id.
- amount (number, required): The amount to be transferred
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Transfer 1 ERC20 token 0.0.6473135 to 0xd94dc7f82f103757f715514e4a37186be6e4580b" means transferring the amount of 1 of the ERC20 token with contract id 0.0.6473135 to the 0xd94dc7f82f103757f715514e4a37186be6e4580b EVM address.
Example: "Transfer 1 ERC20 token 0xd94dc7f82f103757f715514e4a37186be6e4580b to 0.0.6473135" means transferring the amount of 1 of the ERC20 token with contract id 0xd94dc7f82f103757f715514e4a37186be6e4580b to the 0.0.6473135 Hedera account id.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled transfer of ERC20 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC20 token transferred successfully.`;

const transferERC20 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferERC20Parameters>>,
) => {
  const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferERC20Params(
      params,
      ERC20_TRANSFER_FUNCTION_ABI,
      ERC20_TRANSFER_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );

    const tx = HederaBuilder.executeTransaction(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer ERC20';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_erc20_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_ERC20_TOOL = 'transfer_erc20_tool';

const tool = (context: Context): Tool => ({
  method: TRANSFER_ERC20_TOOL,
  name: 'Transfer ERC20',
  description: transferERC20Prompt(context),
  parameters: transferERC20Parameters(context),
  execute: transferERC20,
});

export default tool;
