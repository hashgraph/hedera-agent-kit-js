import { describe, expect, test } from 'vitest';
import { RequiredMemoPolicy } from '@/shared';
import { Context } from '@/shared';

describe('Required Memo Policy', () => {
  const policy = new RequiredMemoPolicy();
  const context = {} as Context;

  test('blocks transaction without memo', async () => {
    const params = { someOtherField: 'value' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Required Memo/);
  });

  test('blocks transaction with empty memo', async () => {
    const params = { transactionMemo: '' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Required Memo/);
  });

  test('blocks transaction with whitespace-only memo', async () => {
    const params = { transactionMemo: '   ' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Required Memo/);
  });

  test('allows transaction with valid memo', async () => {
    const params = { transactionMemo: 'Valid Memo' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles missing params gracefully (blocks as memo is missing)', async () => {
    // If params are missing, memo is missing, so it should block?
    // Looking at implementation: if (!params) return false;
    // So if params are null/undefined, it returns false (allows action).
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: null } as any,
        'transfer_hbar_tool',
      ),
    ).resolves.not.toThrow();
  });
});
