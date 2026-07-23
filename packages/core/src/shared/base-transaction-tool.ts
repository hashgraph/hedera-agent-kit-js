import { PrecheckStatusError, ReceiptStatusError } from '@hiero-ledger/sdk';
import { BaseTool } from './tools';
import { Context } from './configuration';
import { TOOL_STATUS } from './utils/default-tool-output-parsing';

/**
 * Abstract base class for all Hedera transaction tools.
 *
 * Extends {@link BaseTool} with Hedera-specific error handling: when a
 * `ReceiptStatusError` or `PrecheckStatusError` is thrown, the SDK status name
 * and transaction ID are lifted into structured fields on `raw` so callers
 * don't need to parse prose.
 *
 * - `ReceiptStatusError` — thrown by `ExecuteStrategy` when `getReceipt()` returns
 *   a non-SUCCESS status (e.g. `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`).
 * - `PrecheckStatusError` — thrown before a transaction reaches the network when
 *   the node rejects it at the precheck stage (e.g. `INSUFFICIENT_PAYER_BALANCE`).
 *
 * Both error types expose `.status` (SDK `Status` enum) and `.transactionId`
 * (`TransactionId`), so the same structured fields are set for both:
 * - `raw.status` — always `'ERROR'`
 * - `raw.errorCode` — SDK status name, e.g. `'INSUFFICIENT_PAYER_BALANCE'`
 * - `raw.transactionId` — the transaction ID string
 * - `raw.error` — the original error message
 *
 * On successful execution `raw.status` is `'SUCCESS'` (defaulted by
 * `BaseTool.execute()` if not set explicitly upstream by `ExecuteStrategy` or
 * `ReturnBytesStrategy`).
 *
 * This behaviour only applies in `AUTONOMOUS` mode. In `RETURN_BYTES` mode
 * `getReceipt()` is never called, so `ReceiptStatusError` cannot be thrown.
 * `PrecheckStatusError` can in principle still be thrown in `RETURN_BYTES` mode
 * if the node rejects the submission itself, but in practice the bytes are
 * returned before submission and `BaseTool.handleError()` handles all errors.
 */
export abstract class BaseTransactionTool extends BaseTool {
  async handleError(error: unknown, context: Context): Promise<any> {
    if (error instanceof ReceiptStatusError || error instanceof PrecheckStatusError) {
      const errorCode = error.status.toString();
      const associationHint =
        errorCode === 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT'
          ? ' The recipient account has not associated this HTS token.' +
            ' Use the associate_token_tool to associate the account first,' +
            ' or ensure the account has maxAutoAssociations set to -1.'
          : '';
      const message = `Failed to execute ${this.name}: ${error.message}${associationHint}`;
      console.error(`[${this.method}]`, message);
      return {
        raw: {
          status: TOOL_STATUS.ERROR,
          errorCode,
          transactionId: error.transactionId.toString(),
          error: error.message,
        },
        humanMessage: message,
      };
    }
    return super.handleError(error, context);
  }
}
