import { AccountId, Client, ScheduleId, TokenId, TopicId, Transaction, TransactionId, } from '@hiero-ledger/sdk';
import { AgentMode, Context } from '@/shared/configuration';

/** Receipt fields extracted from a submitted Hedera transaction. */
export interface RawTransactionResponse {
  /** String representation of the `Status` returned in the receipt (e.g. `"SUCCESS"`). */
  status: string;
  /** Newly created account ID, or `null` when the transaction did not create an account. */
  accountId: AccountId | null;
  /** Newly created token ID, or `null` when the transaction did not create a token. */
  tokenId: TokenId | null;
  /** Full transaction ID string (e.g. `"0.0.1234@1700000000.000000000"`). */
  transactionId: string;
  /** Newly created topic ID, or `null` when the transaction did not create a topic. */
  topicId: TopicId | null;
  /** Newly created schedule ID, or `null` when the transaction did not create a schedule. */
  scheduleId: ScheduleId | null;
}

/**
 * Standard result envelope returned by all transaction execution strategies.
 *
 * Both `ExecuteStrategy` (used in `AgentMode.AUTONOMOUS`) and user-supplied
 * `TransactionStrategy` implementations (used in `AgentMode.CUSTOM_EXECUTE_TX`) must return
 * this shape. The consistent shape is what allows audit-trail hooks
 * (`HcsAuditTrailHook`, `HolAuditTrailHook`) to work identically across both modes.
 */
export interface ExecuteStrategyResult {
  /** Raw receipt data extracted from the submitted transaction. */
  raw: RawTransactionResponse;
  /** Human-readable summary of the transaction outcome, produced by the `postProcess` callback. */
  humanMessage: string;
}

/**
 * Result returned by `ReturnBytesStrategy` (`AgentMode.RETURN_BYTES`).
 *
 * The transaction is frozen and serialized but **not** signed or submitted.
 * The caller is responsible for signing and broadcasting the bytes out-of-band.
 */
export interface ReturnBytesStrategyResult {
  /** Serialized unsigned transaction bytes ready for client-side signing. */
  bytes: Uint8Array;
}

/**
 * Interface for pluggable transaction signing and execution strategies.
 *
 * @typeParam TResult - The result shape returned by `handle`. Defaults to
 *   `ExecuteStrategyResult`. In `AgentMode.CUSTOM_EXECUTE_TX` a user-provided strategy
 *   (set via `Context.transactionStrategy`) must return
 *   `{ raw: RawTransactionResponse, humanMessage: string }`, which is what enables audit-trail
 *   hooks to work without modification. In `AgentMode.CUSTOM_RETURN_BYTES` the strategy returns
 *   `ReturnBytesStrategyResult` (`{ bytes: Uint8Array }`) instead.
 *
 * Built-in implementations:
 * - `ExecuteStrategy` — signs and executes on-chain (`AgentMode.AUTONOMOUS`).
 * - `ReturnBytesStrategy` — freezes and serializes without executing (`AgentMode.RETURN_BYTES`).
 *
 * @see {@link https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/TRANSACTION_MODES.md}
 */
export interface TransactionStrategy<TResult = ExecuteStrategyResult> {
  /**
   * Execute, sign, or otherwise process a Hedera transaction.
   *
   * @param tx - The built (but not yet frozen or signed) transaction.
   * @param client - Hedera SDK client; used for network operations and freeze.
   * @param context - Execution context containing `accountId`, `mode`, hooks, etc.
   * @param postProcess - Optional formatter that converts `RawTransactionResponse`
   *   into the `humanMessage` string. Defaults to `JSON.stringify` when not provided.
   */
  handle(
    tx: Transaction,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => string,
  ): Promise<TResult>;
}

/**
 * Built-in strategy for `AgentMode.AUTONOMOUS`.
 *
 * Signs the transaction using the operator key on the provided `client`,
 * broadcasts it to the Hedera network, waits for the receipt, and returns
 * an `ExecuteStrategyResult`.
 */
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

/**
 * Built-in strategy for `AgentMode.RETURN_BYTES`.
 *
 * Does **not** sign or submit the transaction. Instead, it assigns a transaction ID,
 * freezes the transaction, and returns the serialized bytes so the caller can
 * sign and broadcast out-of-band (e.g. via a browser wallet or hardware signer).
 *
 * Requires `context.accountId` to generate the transaction ID for the payer account.
 */
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
    case AgentMode.CUSTOM_EXECUTE_TX:
    case AgentMode.CUSTOM_RETURN_BYTES:
      if (!context.transactionStrategy) {
        throw new Error(
          'transactionStrategy must be provided in Context when AgentMode is CUSTOM_EXECUTE_TX or CUSTOM_RETURN_BYTES',
        );
      }
      return context.transactionStrategy;
    case AgentMode.AUTONOMOUS:
    default:
      return new ExecuteStrategy();
  }
};

/**
 * Dispatch a transaction to the strategy selected by `context.mode`.
 *
 * This is the single call-site used by every transaction tool's `secondaryAction`.
 * It resolves the correct `TransactionStrategy` and delegates to its `handle` method.
 *
 * @param tx - The transaction built by the tool's `coreAction`.
 * @param client - Hedera SDK client passed through from the tool invocation.
 * @param context - Execution context; `context.mode` determines which strategy is used.
 * @param postProcess - Optional formatter forwarded to the strategy's `handle` call.
 */
export const handleTransaction = async (
  tx: Transaction,
  client: Client,
  context: Context,
  postProcess?: (response: RawTransactionResponse) => string,
) => {
  const strategy = getStrategyFromContext(context);
  return await strategy.handle(tx, client, context, postProcess);
};
