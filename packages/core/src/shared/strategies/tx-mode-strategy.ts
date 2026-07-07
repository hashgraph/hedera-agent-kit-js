import {
  AccountId,
  Client,
  ScheduleId,
  TokenId,
  TopicId,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';
import { AgentMode, Context } from '@/shared/configuration';

export interface TransactionStrategy {
  handle<T extends Transaction>(
    tx: T,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => unknown,
  ): Promise<any>;
}

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

export class ExecuteStrategy implements TransactionStrategy {
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
    };
  }
}

class ReturnBytesStrategy implements TransactionStrategy {
  async handle(tx: Transaction, client: Client, context: Context) {
    if (!context.accountId)
      throw new Error('Account ID is required in context for RETURN_BYTES mode');
    const id = TransactionId.generate(context.accountId);
    tx.setTransactionId(id).freezeWith(client);
    return { bytes: tx.toBytes() };
  }
}

const getStrategyFromContext = (context: Context): TransactionStrategy => {
  if (context.mode === AgentMode.RETURN_BYTES) {
    return new ReturnBytesStrategy();
  }
  if (context.mode === AgentMode.CUSTOM) {
    if (!context.transactionStrategy) {
      throw new Error('transactionStrategy must be provided in Context when AgentMode is CUSTOM');
    }
    return context.transactionStrategy;
  }
  return new ExecuteStrategy();
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
