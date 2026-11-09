import {
  HBAR_ASSET_ID,
  HEDERA_TESTNET_CAIP2,
  HEDERA_TESTNET_USDC,
  inspectHederaTransaction,
} from '@x402/hedera';
import type { PaymentRequirements, PaymentPayload } from '@x402/core/types';

export interface ActionPaymentSpec {
  action: 'submit_topic_message' | 'mint_fungible_token';
  amount: string; // in tinybars or token smallest units
  asset: string; // "0.0.0" for HBAR or token ID
  description: string;
}

export const PAYMENT_SPECS: Record<string, ActionPaymentSpec> = {
  submit_topic_message: {
    action: 'submit_topic_message',
    amount: '1000000', // 0.01 HBAR (1M tinybars)
    asset: HBAR_ASSET_ID,
    description: 'Micropayment for Hedera Consensus Service (HCS) Topic Message submission',
  },
  mint_fungible_token: {
    action: 'mint_fungible_token',
    amount: '5000000', // 0.05 HBAR (5M tinybars)
    asset: HBAR_ASSET_ID,
    description: 'Micropayment for Hedera Token Service (HTS) Fungible Token Minting',
  },
};

export function getReceiverAccountId(): string {
  return process.env.X402_RECEIVER_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID || '0.0.5001';
}

export function getFeePayerAccountId(): string {
  return process.env.X402_FEE_PAYER_ID || process.env.HEDERA_OPERATOR_ID || '0.0.5001';
}

export function createPaymentRequirements(action: string): PaymentRequirements {
  const spec = PAYMENT_SPECS[action] || PAYMENT_SPECS.submit_topic_message;
  const network =
    process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'hedera:mainnet' : HEDERA_TESTNET_CAIP2;

  return {
    scheme: 'exact',
    network,
    payTo: getReceiverAccountId(),
    amount: spec.amount,
    asset: spec.asset,
    extra: {
      feePayer: getFeePayerAccountId(),
      description: spec.description,
    },
  };
}

export function create402ChallengeResponse(action: string) {
  const requirements = createPaymentRequirements(action);
  const challengeBody = {
    error: 'Payment Required',
    status: 402,
    message:
      'Action is gated by x402 payment protocol. Sign and submit the requested micropayment to proceed.',
    paymentRequirements: requirements,
    supportedAssets: [
      { asset: HBAR_ASSET_ID, name: 'HBAR (tinybars)', decimals: 8 },
      { asset: HEDERA_TESTNET_USDC, name: 'Testnet USDC', decimals: 6 },
    ],
  };

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set(
    'WWW-Authenticate',
    `x402 scheme="exact" network="${requirements.network}" payTo="${requirements.payTo}" amount="${requirements.amount}" asset="${requirements.asset}"`,
  );
  headers.set(
    'x402-payment-required',
    Buffer.from(JSON.stringify(requirements)).toString('base64'),
  );

  return {
    body: challengeBody,
    status: 402,
    headers,
  };
}

export interface VerificationResult {
  valid: boolean;
  payer?: string;
  transactionId?: string;
  amount?: string;
  error?: string;
}

/**
 * Validates the x402 payment transaction payload against requirements.
 */
export async function verifyPaymentPayload(
  payload: { transaction?: string } | string,
  requirements: PaymentRequirements,
): Promise<VerificationResult> {
  const txBase64 = typeof payload === 'string' ? payload : payload.transaction;
  if (!txBase64) {
    return { valid: false, error: 'Missing transaction bytes in payment payload' };
  }

  try {
    const inspected = inspectHederaTransaction(txBase64);

    // Verify transaction is a transfer
    if (inspected.hasNonTransferOperations) {
      return {
        valid: false,
        error: `Expected TransferTransaction, got non-transfer operations: ${inspected.transactionType}`,
      };
    }

    const payTo = requirements.payTo;
    const requiredAmount = BigInt(requirements.amount);

    if (requirements.asset === HBAR_ASSET_ID) {
      const receiverEntry = inspected.hbarTransfers.find(
        t => t.accountId === payTo && BigInt(t.amount) >= requiredAmount,
      );
      if (!receiverEntry) {
        return {
          valid: false,
          error: `No transfer of at least ${requirements.amount} tinybars found for ${payTo}`,
        };
      }

      const payerEntry = inspected.hbarTransfers.find(t => BigInt(t.amount) < 0n);
      return {
        valid: true,
        payer: payerEntry?.accountId || inspected.transactionIdAccountId,
        transactionId: inspected.transactionId,
        amount: receiverEntry.amount,
      };
    } else {
      const tokenTransfers = inspected.tokenTransfers[requirements.asset] || [];
      const receiverEntry = tokenTransfers.find(
        t => t.accountId === payTo && BigInt(t.amount) >= requiredAmount,
      );
      if (!receiverEntry) {
        return {
          valid: false,
          error: `No token transfer of at least ${requirements.amount} found for ${payTo}`,
        };
      }

      const payerEntry = tokenTransfers.find(t => BigInt(t.amount) < 0n);
      return {
        valid: true,
        payer: payerEntry?.accountId || inspected.transactionIdAccountId,
        transactionId: inspected.transactionId,
        amount: receiverEntry.amount,
      };
    }
  } catch (err) {
    return {
      valid: false,
      error:
        err instanceof Error ? err.message : 'The provided x402 payment could not be verified.',
    };
  }
}
