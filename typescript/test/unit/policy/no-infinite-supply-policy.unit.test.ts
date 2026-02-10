import { describe, expect, test } from 'vitest';
import { NoInfiniteSupplyPolicy } from '@/shared';
import { Context } from '@/shared';
import { TokenSupplyType } from '@hashgraph/sdk';

describe('No Infinite Supply Policy', () => {
  const policy = new NoInfiniteSupplyPolicy();
  const context = {} as Context;

  test('blocks token creation with Infinite supply type (enum)', async () => {
    const params = { supplyType: TokenSupplyType.Infinite };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'create_fungible_token_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: No Infinite Supply Policy/);
  });

  test('blocks token creation with Infinite supply type (string)', async () => {
    // Some bindings might pass string 'Infinite'
    const params = { supplyType: 'Infinite' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'create_fungible_token_tool',
      ),
    ).rejects.toThrow(/Action blocked by policy: No Infinite Supply Policy/);
  });

  test('allows token creation with Finite supply type (enum)', async () => {
    const params = { supplyType: TokenSupplyType.Finite };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'create_fungible_token_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('allows token creation with Finite supply type (string)', async () => {
    const params = { supplyType: 'Finite' };
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'create_fungible_token_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles missing params gracefully', async () => {
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: null } as any,
        'create_fungible_token_tool',
      ),
    ).resolves.not.toThrow();
  });

  test('handles params without supplyType', async () => {
    const params = { someOtherField: 'value' };
    // Should pass if supplyType is missing as policy checks 'if (params.supplyType)'
    await expect(
      policy.postParamsNormalizationHook(
        context,
        { normalisedParams: params } as any,
        'create_fungible_token_tool',
      ),
    ).resolves.not.toThrow();
  });
});
