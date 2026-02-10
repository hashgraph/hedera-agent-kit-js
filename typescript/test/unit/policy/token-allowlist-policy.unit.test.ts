import { describe, expect, test } from 'vitest';
import { TokenAllowlistPolicy } from '@/shared';
import { Context } from '@/shared';
import { TokenId, NftId } from '@hashgraph/sdk';

describe('Token Allowlist Policy', () => {
  const allowedTokenId = '0.0.1234';
  const policy = new TokenAllowlistPolicy([allowedTokenId]);
  const context = {} as Context;
  const method = 'transfer_non_fungible_token_tool'; // One of the relevant tools

  test('allows interaction with allowed token (string)', async () => {
    const params = { tokenId: allowedTokenId };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).resolves.not.toThrow();
  });

  test('blocks interaction with not allowed token (string)', async () => {
    const params = { tokenId: '0.0.9999' };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('blocks interaction if one of multiple tokens is not allowed', async () => {
    const params = { tokenIds: [allowedTokenId, '0.0.9999'] };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('checks tokenTransfers array', async () => {
    const params = {
      tokenTransfers: [
        { tokenId: allowedTokenId, amount: 10 },
        { tokenId: '0.0.9999', amount: 10 }, // blocked
      ],
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('checks NFT transfers (nftId)', async () => {
    const params = {
      transfers: [{ nftId: new NftId(TokenId.fromString('0.0.9999'), 1) }], // blocked
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('allows NFT transfer with allowed token', async () => {
    const params = {
      transfers: [{ nftId: new NftId(TokenId.fromString(allowedTokenId), 1) }],
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).resolves.not.toThrow();
  });

  test('checks nftApprovals', async () => {
    const params = {
      nftApprovals: [{ tokenId: '0.0.9999' }],
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('checks tokenApprovals', async () => {
    const params = {
      tokenApprovals: [{ tokenId: '0.0.9999' }],
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('checks nftWipes', async () => {
    const params = {
      nftWipes: [new NftId(TokenId.fromString('0.0.9999'), 1)],
    };
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: params } as any, method),
    ).rejects.toThrow(/Action blocked by policy: Token Allowlist/);
  });

  test('handles missing params gracefully', async () => {
    await expect(
      policy.postParamsNormalizationHook(context, { normalisedParams: null } as any, method),
    ).resolves.not.toThrow();
  });
});
