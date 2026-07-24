import { describe, expect, it } from 'vitest';
import {
  Client,
  FileCreateTransaction,
  Hbar,
  Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { handleTransaction, ReturnBytesResult } from '@/shared/strategies/tx-mode-strategy';
import { AgentMode } from '@/shared/configuration';

describe('ReturnBytesStrategy', () => {
  it('returns bytes together with transaction context', async () => {
    const client = Client.forTestnet();
    const tx = new TransferTransaction()
      .addHbarTransfer('0.0.1001', new Hbar(-1))
      .addHbarTransfer('0.0.2002', new Hbar(1));

    const res = (await handleTransaction(tx, client, {
      mode: AgentMode.RETURN_BYTES,
      accountId: '0.0.1001',
    })) as ReturnBytesResult;

    expect(res.bytes).toBeInstanceOf(Uint8Array);
    expect(res.payerAccountId).toBe('0.0.1001');
    expect(res.type).toBe('TransferTransaction');
    expect(res.transactionId).toMatch(/^0\.0\.1001@/);
    expect(res.memo).toBe('');
    // default validDuration is 120 s from validStart (~now)
    const expiresIn = new Date(res.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(100_000);
    expect(expiresIn).toBeLessThanOrEqual(121_000);
    // bytes must round-trip to the same transaction id
    expect(Transaction.fromBytes(res.bytes).transactionId?.toString()).toBe(res.transactionId);
  });

  it('throws without accountId in context', async () => {
    await expect(
      handleTransaction(new TransferTransaction(), Client.forTestnet(), {
        mode: AgentMode.RETURN_BYTES,
      }),
    ).rejects.toThrow('Account ID is required');
  });

  it('falls back to a generic type label for transaction types not in the map', async () => {
    const res = (await handleTransaction(new FileCreateTransaction(), Client.forTestnet(), {
      mode: AgentMode.RETURN_BYTES,
      accountId: '0.0.1001',
    })) as ReturnBytesResult;

    expect(res.type).toBe('Transaction');
  });
});
