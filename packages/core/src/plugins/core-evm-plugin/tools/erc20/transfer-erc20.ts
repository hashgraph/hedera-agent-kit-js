import { z } from 'zod';
import { type Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { transferERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  ERC20_TRANSFER_FUNCTION_ABI,
  ERC20_TRANSFER_FUNCTION_NAME,
} from '@/shared/constants/contracts';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';
import { assertEcdsaOperator } from '@/plugins/core-evm-plugin/utils/operator-key';

const transferERC20Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will transfer a given amount of an existing ERC20 token on Hedera via its EVM smart contract.
Use this tool when the user mentions "ERC20", "EVM token", or transferring tokens from a smart contract.
Do NOT use for HTS (Hedera Token Service) native tokens — those are identified by a token ID, not a contract.
Always use this tool when the user mentions "ERC20", "ERC-20", or "contract" as the token source — regardless of the amount being transferred.

Parameters:
- contractId (str, required): The ERC20 smart contract address (EVM or Hedera format). This is a CONTRACT address, NOT a token ID.
- recipientAddress (str, required): Recipient address (EVM or Hedera format).
- amount (number, required): Amount to transfer in display units.
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Transfer 25 erc20 tokens from contract 0.0.1234 to 0.0.5678" → contractId=0.0.1234, recipientAddress=0.0.5678, amount=25.
Example: "Send 100 ERC20 tokens (contract: 0.0.5555) to 0.0.6666" → contractId=0.0.5555, recipientAddress=0.0.6666, amount=100.
Example: "Move 200 erc20 tokens of contract 0x1111...1111 to 0.0.4444" → contractId=0x1111...1111, recipientAddress=0.0.4444, amount=200.
Example: "Transfer 1000000 ERC20 tokens from contract 0.0.1234 to 0.0.5678" means transferring 1000000 tokens of the ERC20 contract 0.0.1234 to the account 0.0.5678 — the contractId is 0.0.1234 and the recipientAddress is 0.0.5678.
`;
};

const postProcess = (response: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled transfer of ERC20 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC20 token transferred successfully.`;

export const TRANSFER_ERC20_TOOL = 'transfer_erc20_tool';

export class TransferErc20Tool extends BaseTransactionTool {
  method = TRANSFER_ERC20_TOOL;
  name = 'Transfer ERC20';
  description: string;
  parameters: ReturnType<typeof transferERC20Parameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferERC20Prompt(context);
    this.parameters = transferERC20Parameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferERC20Parameters>>,
    context: Context,
    client: Client,
  ) {
    assertEcdsaOperator(client);
    const mirrorNode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return await HederaParameterNormaliser.normaliseTransferERC20Params(
      params,
      ERC20_TRANSFER_FUNCTION_ABI,
      ERC20_TRANSFER_FUNCTION_NAME,
      context,
      mirrorNode,
      client,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.executeTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context: Context): BaseTransactionTool => new TransferErc20Tool(context);

export default tool;
