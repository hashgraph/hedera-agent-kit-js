import {
  AccountAllowanceApproveTransaction,
  AccountAllowanceDeleteTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  Client,
  ContractExecuteTransaction,
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  ScheduleId,
  ScheduleSignTransaction,
  TokenAirdropTransaction,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenDeleteTransaction,
  TokenDissociateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenUpdateTransaction,
  TopicCreateTransaction,
  TopicDeleteTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
  TopicUpdateTransaction,
  Transaction,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { AgentMode, Context } from '@/shared/configuration';
import { TOOL_STATUS, ToolRawStatus } from '@/shared/utils/default-tool-output-parsing';

interface TxModeStrategy {
  handle<T extends Transaction>(
    tx: T,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => unknown,
  ): Promise<unknown>;
}

export interface RawTransactionResponse {
  status: string;
  accountId: AccountId | null;
  tokenId: TokenId | null;
  /** Serial numbers assigned to newly minted NFTs; empty array for non-NFT transactions. */
  serials: string[];
  transactionId: string;
  topicId: TopicId | null;
  scheduleId: ScheduleId | null;
}

export interface ExecuteStrategyResult {
  raw: RawTransactionResponse;
  humanMessage: string;
}

export class ExecuteStrategy implements TxModeStrategy {
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
      serials: receipt.serials.map(s => s.toString()),
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

/**
 * Structured result returned by every transaction tool in {@link AgentMode.RETURN_BYTES}
 * mode: the frozen, unsigned transaction bytes plus the context an external wallet or host
 * application needs to review, sign, and submit them.
 *
 * Serialised to JSON as the tool output; consumers can classify it with `classifyToolResult`
 * (`status` is always {@link TOOL_STATUS.SUCCESS} here, so it maps to `success`). See
 * `docs/MCP.md` for the full non-custodial flow.
 */
export interface ReturnBytesResult {
  /** Frozen transaction bytes, ready to be signed and submitted by an external wallet. */
  bytes: Uint8Array;
  /**
   * Tool-result status. Always {@link TOOL_STATUS.SUCCESS} here — serialising to
   * bytes cannot fail once the transaction is frozen. Present so RETURN_BYTES
   * output classifies as `success` via `classifyToolResult`.
   */
  status: ToolRawStatus;
  /** Transaction ID set on the frozen transaction, e.g. `0.0.1234@1700000000.000000000`. */
  transactionId: string;
  /** Account expected to pay for and sign the transaction (the context account). */
  payerAccountId: string;
  /** SDK transaction class name, e.g. `TransferTransaction`. */
  type: string;
  /**
   * ISO timestamp after which the network rejects the transaction with
   * TRANSACTION_EXPIRED (`validStart` + `transactionValidDuration`, 120 s by default).
   * Sign and submit before this time, or request fresh bytes.
   */
  expiresAt: string;
  /** Transaction memo; empty string when unset. */
  memo: string;
}

/**
 * Resolve a frozen transaction to a stable, human-readable type label for the RETURN_BYTES
 * {@link ReturnBytesResult.type} field. Returns `'Transaction'` for any type not listed.
 */
const getTransactionType = (tx: Transaction): string => {
  const labels: ReadonlyArray<[new (...args: any[]) => Transaction, string]> = [
    [AccountAllowanceApproveTransaction, 'AccountAllowanceApproveTransaction'],
    [AccountAllowanceDeleteTransaction, 'AccountAllowanceDeleteTransaction'],
    [AccountCreateTransaction, 'AccountCreateTransaction'],
    [AccountDeleteTransaction, 'AccountDeleteTransaction'],
    [AccountUpdateTransaction, 'AccountUpdateTransaction'],
    [ContractExecuteTransaction, 'ContractExecuteTransaction'],
    [ScheduleCreateTransaction, 'ScheduleCreateTransaction'],
    [ScheduleDeleteTransaction, 'ScheduleDeleteTransaction'],
    [ScheduleSignTransaction, 'ScheduleSignTransaction'],
    [TokenAirdropTransaction, 'TokenAirdropTransaction'],
    [TokenAssociateTransaction, 'TokenAssociateTransaction'],
    [TokenCreateTransaction, 'TokenCreateTransaction'],
    [TokenDeleteTransaction, 'TokenDeleteTransaction'],
    [TokenDissociateTransaction, 'TokenDissociateTransaction'],
    [TokenMintTransaction, 'TokenMintTransaction'],
    [TokenUpdateTransaction, 'TokenUpdateTransaction'],
    [TopicCreateTransaction, 'TopicCreateTransaction'],
    [TopicDeleteTransaction, 'TopicDeleteTransaction'],
    [TopicMessageSubmitTransaction, 'TopicMessageSubmitTransaction'],
    [TopicUpdateTransaction, 'TopicUpdateTransaction'],
    [TransferTransaction, 'TransferTransaction'],
  ];
  return labels.find(([ctor]) => tx instanceof ctor)?.[1] ?? 'Transaction';
};

class ReturnBytesStrategy implements TxModeStrategy {
  /**
   * Serializes the transaction to bytes instead of submitting it, returning the
   * bytes alongside the transaction context an external wallet needs to sign it
   * (payer, type, expiry, memo).
   */
  async handle(tx: Transaction, client: Client, context: Context): Promise<ReturnBytesResult> {
    if (!context.accountId)
      throw new Error('Account ID is required in context for RETURN_BYTES mode');
    const id = TransactionId.generate(context.accountId);
    tx.setTransactionId(id).freezeWith(client);
    return {
      bytes: tx.toBytes(),
      status: TOOL_STATUS.SUCCESS,
      transactionId: id.toString(),
      payerAccountId: context.accountId,
      type: getTransactionType(tx),
      expiresAt: new Date(
        id.validStart!.toDate().getTime() + tx.transactionValidDuration * 1000,
      ).toISOString(),
      memo: tx.transactionMemo,
    };
  }
}

const getStrategyFromContext = (context: Context) => {
  if (context.mode === AgentMode.RETURN_BYTES) {
    return new ReturnBytesStrategy();
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
