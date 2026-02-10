import { describe, expect, test } from 'vitest';
import { ImmutabilityPolicy } from '@/shared';
import { Context } from '@/shared';
import { AccountId, TokenId } from '@hashgraph/sdk';

describe('Immutability Policy', () => {
  const immutableAccountId = '0.0.1234';
  const immutableTokenId = '0.0.5678';
  const policy = new ImmutabilityPolicy({
    accounts: [immutableAccountId],
    tokens: [immutableTokenId],
  });
  const context = {} as Context;

  test('blocks action on immutable account (string)', async () => {
    const params = { accountId: immutableAccountId };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_account_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Immutability Policy/);
  });

  test('blocks action on immutable account (AccountId)', async () => {
    const params = { accountId: AccountId.fromString(immutableAccountId) };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_account_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Immutability Policy/);
  });

  test('blocks action on immutable token (string)', async () => {
    const params = { tokenId: immutableTokenId };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_token_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Immutability Policy/);
  });

  test('blocks action on immutable token (TokenId)', async () => {
    const params = { tokenId: TokenId.fromString(immutableTokenId) };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_token_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: Immutability Policy/);
  });

  test('allows action on non-immutable account', async () => {
    const params = { accountId: '0.0.9999' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_account_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('allows action on non-immutable token', async () => {
    const params = { tokenId: '0.0.9999' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_token_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('ignores irrelevant tools', async () => {
    const params = { accountId: immutableAccountId };
    // 'some_other_tool' is not in relevantTools
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'some_other_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles missing params gracefully', async () => {
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: null } as any,
        'update_account_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles params without accountId or tokenId', async () => {
    const params = { someOtherField: 'value' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'update_account_tool',
      ),
    ).resolves.not.toThrow();
  });
});
