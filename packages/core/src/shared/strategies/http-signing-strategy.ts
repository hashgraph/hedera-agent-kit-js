import { Client, Transaction, TransactionId } from '@hiero-ledger/sdk';
import { Context } from '@/shared';
import { RawTransactionResponse, TxModeStrategy } from '@/shared';

export interface HttpSigningStrategyOptions {
  endpoint: string;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  encoding?: 'base64' | 'hex';
  // Formats request body sent to the external signing service
  buildRequestBody?: (txBytes: Uint8Array, context: Context) => Promise<any> | any;
  // Parses response body returning signed transaction bytes
  parseResponseBody?: (response: any) => Promise<Uint8Array> | Uint8Array;
}

export class HttpSigningStrategy implements TxModeStrategy {
  constructor(private options: HttpSigningStrategyOptions) {}

  async handle(
    tx: Transaction,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => string,
  ) {
    if (!context.accountId) {
      throw new Error('Account ID is required in context for external signing');
    }

    // 1. Freeze the transaction to produce stable bytes
    if (!tx.transactionId) {
      tx.setTransactionId(TransactionId.generate(context.accountId));
    }
    tx.freezeWith(client);

    const txBytes = tx.toBytes();
    const encoding = this.options.encoding || 'base64';
    
    // 2. Prepare payload
    let body: any;
    if (this.options.buildRequestBody) {
      body = await this.options.buildRequestBody(txBytes, context);
    } else {
      const encodedBytes = encoding === 'base64' 
        ? Buffer.from(txBytes).toString('base64')
        : Buffer.from(txBytes).toString('hex');
      body = { transactionBytes: encodedBytes };
    }

    // 3. Resolve headers
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.options.headers) {
      const resolvedHeaders = typeof this.options.headers === 'function'
        ? await this.options.headers()
        : this.options.headers;
      headers = { ...headers, ...resolvedHeaders };
    }

    // 4. Call external signing endpoint
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`External signing service failed (${response.status}): ${await response.text()}`);
    }

    const responseData = await response.json();

    // 5. Parse out the signed bytes
    let signedTxBytes: Uint8Array;
    if (this.options.parseResponseBody) {
      signedTxBytes = await this.options.parseResponseBody(responseData);
    } else {
      const encodedSignedBytes = responseData.signedTransactionBytes;
      if (!encodedSignedBytes) {
        throw new Error('Invalid response: missing signedTransactionBytes');
      }
      signedTxBytes = encoding === 'base64'
        ? new Uint8Array(Buffer.from(encodedSignedBytes, 'base64'))
        : new Uint8Array(Buffer.from(encodedSignedBytes, 'hex'));
    }

    // 6. Reconstruct signed transaction
    const signedTx = Transaction.fromBytes(signedTxBytes);

    // 7. Execute on-chain
    const submit = await signedTx.execute(client);
    const receipt = await submit.getReceipt(client);

    const rawTransactionResponse: RawTransactionResponse = {
      status: receipt.status.toString(),
      accountId: receipt.accountId,
      tokenId: receipt.tokenId,
      transactionId: signedTx.transactionId?.toString() ?? '',
      topicId: receipt.topicId,
      scheduleId: receipt.scheduleId,
    };

    const defaultPostProcess = (res: RawTransactionResponse) => JSON.stringify(res, null, 2);
    const postProcessor = postProcess || defaultPostProcess;

    return {
      raw: rawTransactionResponse,
      humanMessage: postProcessor(rawTransactionResponse),
    };
  }
}
