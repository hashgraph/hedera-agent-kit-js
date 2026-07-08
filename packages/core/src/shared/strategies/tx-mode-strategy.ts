import { AccountId, Client, ScheduleId, TokenId, TopicId, Transaction, TransactionId, } from '@hiero-ledger/sdk';
import { AgentMode, Context } from '@/shared/configuration';

export interface RawTransactionResponse {
  status: string;
  accountId: AccountId | null;
  tokenId: TokenId | null;
  transactionId: string;
  topicId: TopicId | null;
  scheduleId: ScheduleId | null;
}

export interface ExecuteStrategyResult {
  raw: RawTransactionResponse;
  humanMessage: string;
}

export interface ReturnBytesStrategyResult {
  bytes: Uint8Array;
}

export interface TransactionStrategy<TResult = ExecuteStrategyResult> {
  handle(
    tx: Transaction,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => string,
  ): Promise<TResult>;
}

export class ExecuteStrategy implements TransactionStrategy<ExecuteStrategyResult> {
  defaultPostProcess(response: RawTransactionResponse): string {
    return JSON.stringify(response, null, 2);
  }

  async handle(
    tx: Transaction,
    client: Client,
    _context: Context,
    postProcess: (response: RawTransactionResponse) => string = this.defaultPostProcess,
  ) {
    const submit = await tx.execute(client);
    const receipt = await submit.getReceipt(client);
    const rawTransactionResponse: RawTransactionResponse = {
      status: receipt.status.toString(),
      accountId: receipt.accountId,
      tokenId: receipt.tokenId,
      transactionId: tx.transactionId?.toString() ?? '',
      topicId: receipt.topicId,
      scheduleId: receipt.scheduleId,
    };
    return {
      raw: rawTransactionResponse,
      humanMessage: postProcess(rawTransactionResponse),
    } as ExecuteStrategyResult;
  }
}

export class ReturnBytesStrategy implements TransactionStrategy<ReturnBytesStrategyResult> {
  async handle(tx: Transaction, client: Client, context: Context) {
    if (!context.accountId)
      throw new Error('Account ID is required in context for RETURN_BYTES mode');
    const id = TransactionId.generate(context.accountId);
    tx.setTransactionId(id).freezeWith(client);
    return { bytes: tx.toBytes() } as ReturnBytesStrategyResult;
  }
}

const getStrategyFromContext = (context: Context): TransactionStrategy<unknown> => {
  switch (context.mode) {
    case AgentMode.RETURN_BYTES:
      return new ReturnBytesStrategy();
    case AgentMode.CUSTOM:
      if (!context.transactionStrategy) {
        throw new Error('transactionStrategy must be provided in Context when AgentMode is CUSTOM');
      }
      return context.transactionStrategy;
    case AgentMode.AUTONOMOUS:
    default:
      return new ExecuteStrategy();
  }
};

export const handleTransaction = async (
  tx: Transaction,
  client: Client,
  context: Context,
  postProcess?: (response: RawTransactionResponse) => string,
) => {
  const strategy = getStrategyFromContext(context);
  return await strategy.handle(tx, client, context, postProcess);
};
