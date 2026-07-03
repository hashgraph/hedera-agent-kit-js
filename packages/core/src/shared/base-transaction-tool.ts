import { ReceiptStatusError } from '@hiero-ledger/sdk';
import { BaseTool } from './tools';
import { Context } from './configuration';

/**
 * Abstract base class for all Hedera transaction tools.
 *
 * Extends {@link BaseTool} with Hedera-specific error handling: when a
 * `ReceiptStatusError` is thrown (i.e. `ExecuteStrategy` received a non-SUCCESS
 * receipt from the network), the SDK status name and transaction ID are lifted
 * into structured fields on `raw` so callers don't need to parse prose.
 *
 * `raw.status` is always `'ERROR'`; the additional fields are:
 * - `raw.errorCode` — SDK status name, e.g. `'INSUFFICIENT_PAYER_BALANCE'`
 * - `raw.transactionId` — the transaction ID string
 * - `raw.error` — the original error message
 *
 * This behaviour only applies in `AUTONOMUS` mode. In
 * `RETURN_BYTES` mode `getReceipt()` is never called, so `ReceiptStatusError`
 * cannot be thrown and `BaseTool.handleError()` handles all errors generically.
 */
export abstract class BaseTransactionTool extends BaseTool {
  async handleError(error: unknown, context: Context): Promise<any> {
    if (error instanceof ReceiptStatusError) {
      const message = `Failed to execute ${this.name}: ${error.message}`;
      console.error(`[${this.method}]`, message);
      return {
        raw: {
          status: 'ERROR',
          errorCode: error.status.toString(),
          transactionId: error.transactionId.toString(),
          error: error.message,
        },
        humanMessage: message,
      };
    }
    return super.handleError(error, context);
  }
}
