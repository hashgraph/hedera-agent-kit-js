import { AccountId, Client, TransactionId, TransactionReceiptQuery } from '@hiero-ledger/sdk';
import { HBAR_ASSET_ID, HEDERA_TESTNET_CAIP2, inspectHederaTransaction } from '@x402/hedera';

export interface PaymentReceipt {
  transactionId: string;
  payer: string;
  payTo: string;
  amount: string;
  asset: string;
  network?: string;
  consensusTimestamp?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

export interface VerificationOptions {
  client?: Client;
  skipOnChainCheck?: boolean;
}

/**
 * Validates an x402 payment receipt server-side before tool execution.
 * Checks amount, recipient, asset type, and optionally queries consensus receipt.
 */
export async function verifyPaymentReceipt(
  receipt: PaymentReceipt,
  expectedRequirement: {
    payTo: string;
    amount: string;
    asset: string;
  },
  options: VerificationOptions = {},
): Promise<{ valid: boolean; error?: string; verifiedContext?: Record<string, unknown> }> {
  if (!receipt || !receipt.transactionId) {
    return { valid: false, error: 'Missing transactionId in receipt' };
  }

  if (receipt.payTo !== expectedRequirement.payTo) {
    return {
      valid: false,
      error: `Invalid recipient: expected ${expectedRequirement.payTo}, got ${receipt.payTo}`,
    };
  }

  if (receipt.asset !== expectedRequirement.asset) {
    return {
      valid: false,
      error: `Invalid asset: expected ${expectedRequirement.asset}, got ${receipt.asset}`,
    };
  }

  const receivedAmount = BigInt(receipt.amount);
  const requiredAmount = BigInt(expectedRequirement.amount);

  if (receivedAmount < requiredAmount) {
    return {
      valid: false,
      error: `Insufficient payment: expected ${expectedRequirement.amount}, received ${receipt.amount}`,
    };
  }

  if (options.client && !options.skipOnChainCheck) {
    try {
      const txId = TransactionId.fromString(receipt.transactionId);
      const query = new TransactionReceiptQuery().setTransactionId(txId);
      const txReceipt = await query.execute(options.client);

      if (txReceipt.status.toString() !== 'SUCCESS') {
        return {
          valid: false,
          error: `On-chain transaction status is ${txReceipt.status.toString()}`,
        };
      }
    } catch (err) {
      // If mirror node has not indexed yet or node query fails in dev, fail closed unless mocked
      return {
        valid: false,
        error: `Failed to verify transaction on-chain: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    valid: true,
    verifiedContext: {
      paymentVerified: true,
      transactionId: receipt.transactionId,
      payer: receipt.payer,
      amount: receipt.amount,
      asset: receipt.asset,
      verifiedAt: new Date().toISOString(),
    },
  };
}
