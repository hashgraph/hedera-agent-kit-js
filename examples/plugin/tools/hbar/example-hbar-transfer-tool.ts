import { z } from 'zod';
import {
  Context,
  BaseTransactionTool,
  handleTransaction,
  PromptGenerator,
  AccountResolver,
  transactionToolOutputParser,
  RawTransactionResponse,
} from '@hashgraph/hedera-agent-kit';
import { Client, TransferTransaction, Hbar, AccountId } from '@hiero-ledger/sdk';

export const EXAMPLE_HBAR_TRANSFER_TOOL = 'example_hbar_transfer_tool';

const postProcessHbarTransfer = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled HBAR transfer created successfully.\nTransaction ID: ${response.transactionId}\nSchedule ID: ${response.scheduleId.toString()}`;
  }
  return `HBAR successfully transferred to 0.0.800.\nTransaction ID: ${response.transactionId}`;
};

export class ExampleHbarTransferTool extends BaseTransactionTool {
  method = EXAMPLE_HBAR_TRANSFER_TOOL;
  name = 'Example HBAR Transfer';
  description: string;
  parameters: z.ZodObject<any, any>;

  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();

    const contextSnippet = PromptGenerator.getContextSnippet(context);
    const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
      'sourceAccountId',
      context,
    );
    const usageInstructions = PromptGenerator.getParameterUsageInstructions();

    this.description = `
${contextSnippet}

This example plugin tool demonstrates how to create HBAR transfers using the
Hedera Agent Kit transaction strategy pattern (v4 BaseTool approach).
It will transfer HBAR to account 0.0.800 as a demonstration.

Parameters:
- hbarAmount (number, required): Amount of HBAR to transfer to account 0.0.800
- ${sourceAccountDesc}
- transactionMemo (str, optional): Optional memo for the transaction

${usageInstructions}
`;

    this.parameters = z.object({
      hbarAmount: z.number().positive('HBAR amount must be positive'),
      sourceAccountId: z.string().optional(),
      transactionMemo: z.string().optional(),
    });
  }

  async normalizeParams(
    params: { hbarAmount: number; sourceAccountId?: string; transactionMemo?: string },
    context: Context,
    client: Client,
  ) {
    const sourceAccount = AccountResolver.resolveAccount(params.sourceAccountId, context, client);
    return { ...params, resolvedSourceAccount: sourceAccount };
  }

  async coreAction(
    normalisedParams: {
      hbarAmount: number;
      resolvedSourceAccount: string;
      transactionMemo?: string;
    },
    _context: Context,
    _client: Client,
  ) {
    const destinationAccount = AccountId.fromString('0.0.800');
    const transferAmount = new Hbar(normalisedParams.hbarAmount);

    const tx = new TransferTransaction()
      .addHbarTransfer(normalisedParams.resolvedSourceAccount, transferAmount.negated())
      .addHbarTransfer(destinationAccount, transferAmount);

    if (normalisedParams.transactionMemo) {
      tx.setTransactionMemo(normalisedParams.transactionMemo);
    }

    return tx;
  }

  async secondaryAction(transaction: TransferTransaction, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcessHbarTransfer);
  }

}

const tool = (context: Context): BaseTransactionTool => new ExampleHbarTransferTool(context);

export default tool;
