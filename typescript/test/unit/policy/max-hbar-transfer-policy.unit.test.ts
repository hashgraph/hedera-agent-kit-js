import { describe, expect, test } from 'vitest';
import { MaxHbarTransferPolicy } from '@/shared';
import { Context } from '@/shared';
import { Hbar } from '@hashgraph/sdk';

describe('Max HBAR Transfer Policy', () => {
  const maxAmount = 100;
  const policy = new MaxHbarTransferPolicy(maxAmount);
  const context = {} as Context;

  test('blocks transfer exceeding max amount', async () => {
    const params = {
      hbarTransfers: [{ amount: new Hbar(150), accountId: '0.0.1234' }],
    };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Max HBAR Transfer/);
  });

  test('allows transfer within max amount', async () => {
    const params = {
      hbarTransfers: [{ amount: new Hbar(50), accountId: '0.0.1234' }],
    };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('allows transfer equal to max amount', async () => {
    const params = {
      hbarTransfers: [{ amount: new Hbar(100), accountId: '0.0.1234' }],
    };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('ignores negative transfers (debits)', async () => {
    // Negative amount means debit from source, which shouldn't trigger the limit check logic for "spending" in this specific implementation
    // The policy checks: if (hbarAmount > 0 && hbarAmount > this.maxAmount)
    const params = {
      hbarTransfers: [{ amount: new Hbar(-150), accountId: '0.0.1234' }],
    };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles missing params gracefully', async () => {
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: null } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles params without hbarTransfers', async () => {
    const params = { someOtherField: 'value' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });
});
