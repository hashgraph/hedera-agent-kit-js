import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import { Client } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const transferFungibleTokenWithAllowancePrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

Transfers HTS (Hedera Token Service) fungible tokens on behalf of another account using a pre-approved token allowance.
Use ONLY when the user explicitly mentions spending an "allowance" or transferring tokens pre-approved by another account.
Do NOT use for ERC20 or EVM smart contract tokens — use transfer_erc20_tool for those.
Do NOT infer sourceAccountId from context; it must be explicitly provided by the user.

Parameters:
- tokenId (string, required): HTS token ID (e.g. "0.0.12345"). NOT an ERC20 contract address.
- sourceAccountId (string, required): Account ID of the token owner who granted the allowance (must be explicitly stated by the user).
- transfers (array of objects, required): List of token transfers:
  - accountId (string, required): Recipient account ID
  - amount (number, required): Amount to transfer in display units
- transactionMemo (string, optional): Optional memo for the transaction
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${usageInstructions}

Example: "Spend allowance from 0.0.1002 to send 25 TKN (token 0.0.33333) to 0.0.2002" → tokenId=0.0.33333, sourceAccountId=0.0.1002, transfers=[{accountId:0.0.2002, amount:25}].
Example: "Use allowance from 0.0.1002 to send 50 TKN (0.0.33333) to 0.0.2002 and 75 to 0.0.3003" → tokenId=0.0.33333, sourceAccountId=0.0.1002, transfers=[{accountId:0.0.2002,amount:50},{accountId:0.0.3003,amount:75}].
`;
};

const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled allowance transfer created successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`;
  }
  return `Fungible tokens successfully transferred with allowance.
Transaction ID: ${response.transactionId}`;
};

export const TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
  'transfer_fungible_token_with_allowance_tool';

export class TransferFungibleTokenWithAllowanceTool extends BaseTransactionTool {
  method = TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL;
  name = 'Transfer Fungible Token with Allowance';
  description: string;
  parameters: ReturnType<typeof transferFungibleTokenWithAllowanceParameters>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = transferFungibleTokenWithAllowancePrompt(context);
    this.parameters = transferFungibleTokenWithAllowanceParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const mirrornode = getMirrornodeService(context.mirrornodeService, client.ledgerId!);
    return HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
      params,
      context,
      client,
      mirrornode,
    );
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const tx = HederaBuilder.transferFungibleTokenWithAllowance(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, context: Context): Promise<any> {
    const result = await super.handleError(error, context);
    if (result?.raw?.errorCode === 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT') {
      result.humanMessage +=
        ' The recipient account has not associated this HTS token.' +
        ' Use the associate_token_tool to associate the account first,' +
        ' or ensure the account has maxAutoAssociations set to -1.';
    }
    return result;
  }
}

const tool = (context: Context): BaseTransactionTool =>
  new TransferFungibleTokenWithAllowanceTool(context);

export default tool;
