import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId, Client, TokenId, TokenAllowance } from '@hiero-ledger/sdk';
import type { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import Long from 'long';

// ---- Mocks ----
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HederaParameterNormaliser.normaliseApproveTokenAllowance', () => {
  let mockContext: Context;
  let mockClient: Client;
  let mockMirrorNode: any;

  const resolvedOwner = AccountId.fromString('0.0.1234').toString();
  const spender = '0.0.5678';
  const tokenId = '0.0.9999';

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    mockMirrorNode = {
      getTokenInfo: vi.fn().mockResolvedValue({ decimals: 2 }), // default 2 decimals
    };
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(resolvedOwner);
  });

  it('normalizes params with explicit owner, single token allowance, positive integer amount, and memo', async () => {
    const params = {
      ownerAccountId: resolvedOwner,
      spenderAccountId: spender,
      tokenApprovals: [{ tokenId, amount: 100 }],
      transactionMemo: 'approve FT allowance',
    };

    const res = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
      resolvedOwner,
      mockContext,
      mockClient,
    );

    expect(res.tokenApprovals?.length).toBe(1);
    const a = res.tokenApprovals![0] as TokenAllowance;
    expect(a.ownerAccountId!.toString()).toBe(resolvedOwner);
    expect(a.spenderAccountId!.toString()).toBe(spender);
    expect(a.tokenId.toString()).toBe(TokenId.fromString(tokenId).toString());
    expect(Long.isLong(a.amount)).toBe(true);
    // With 2 decimals, base = 100 * 10^2 = 10000
    expect(a.amount!.toString()).toBe(Long.fromNumber(10000).toString());
    expect(res.transactionMemo).toBe('approve FT allowance');
  });

  it('supports multiple token allowances', async () => {
    const params = {
      spenderAccountId: spender,
      tokenApprovals: [
        { tokenId: '0.0.1', amount: 1 },
        { tokenId: '0.0.2', amount: 2 },
        { tokenId: '0.0.3', amount: 3 },
      ],
    };

    const res = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    expect(res.tokenApprovals?.map(a => a.tokenId.toString())).toEqual([
      TokenId.fromString('0.0.1').toString(),
      TokenId.fromString('0.0.2').toString(),
      TokenId.fromString('0.0.3').toString(),
    ]);
    expect(res.tokenApprovals?.map(a => a.amount!.toString())).toEqual([
      Long.fromNumber(100).toString(), // 1 * 10^2
      Long.fromNumber(200).toString(), // 2 * 10^2
      Long.fromNumber(300).toString(), // 3 * 10^2
    ]);
  });

  it('defaults ownerAccountId using AccountResolver when not provided', async () => {
    const params = {
      spenderAccountId: spender,
      tokenApprovals: [{ tokenId, amount: 5 }],
    };

    const res = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, mockContext, mockClient);
    expect(res.tokenApprovals?.[0]!.ownerAccountId!.toString()).toBe(resolvedOwner);
  });

  it('throws error when amount is non-integer, zero, or negative', async () => {
    const invalids = [-1, Number.NaN];

    for (const invalid of invalids) {
      const p = {
        spenderAccountId: spender,
        tokenApprovals: [{ tokenId, amount: invalid as number }],
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseApproveTokenAllowance(
          p,
          mockContext,
          mockClient,
          mockMirrorNode,
        ),
      ).rejects.toThrowError(new RegExp(`Invalid parameters: Field "tokenApprovals.0.amount"`));
    }
  });

  it('handles missing decimals by defaulting to 0', async () => {
    mockMirrorNode.getTokenInfo.mockResolvedValueOnce({}); // no decimals
    const params = {
      spenderAccountId: spender,
      tokenApprovals: [{ tokenId, amount: 7 }],
    };

    const res = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    const a = res.tokenApprovals![0];
    // With decimals=0, base = 7
    expect(a.amount!.toString()).toBe(Long.fromNumber(7).toString());
  });

  describe('HTS int64 overflow guard', () => {
    // Long.MAX_VALUE = 9_223_372_036_854_775_807
    // With 0 decimals, display amount == base amount, so we can test directly.

    it('rejects an amount whose base-unit value exceeds int64 max', async () => {
      // 9_223_372_036_854_775_808 is Long.MAX_VALUE + 1
      // With 0 decimals the display amount equals the base amount.
      mockMirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: 0 });

      const params = {
        spenderAccountId: spender,
        // 9.3e18 in display units with 0 decimals → base = 9.3e18 > int64 max
        tokenApprovals: [{ tokenId, amount: 9_300_000_000_000_000_000 }],
      };

      await expect(
        HederaParameterNormaliser.normaliseApproveTokenAllowance(
          params as any,
          mockContext,
          mockClient,
          mockMirrorNode,
        ),
      ).rejects.toThrow(/exceeds the HTS int64 maximum/);
    });

    it('rejects approve(spender, maxUint256) equivalent (Number.MAX_VALUE)', async () => {
      mockMirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: 0 });

      const params = {
        spenderAccountId: spender,
        tokenApprovals: [{ tokenId, amount: Number.MAX_VALUE }],
      };

      await expect(
        HederaParameterNormaliser.normaliseApproveTokenAllowance(
          params as any,
          mockContext,
          mockClient,
          mockMirrorNode,
        ),
      ).rejects.toThrow(/exceeds the HTS int64 maximum/);
    });

    it('accepts an amount whose base-unit value is exactly int64 max (with 0 decimals)', async () => {
      // Long.MAX_VALUE = 9_223_372_036_854_775_807
      // JS cannot represent this exactly as a float64, but BigNumber can.
      // We use a safe value just below to avoid float64 precision issues in the test itself.
      mockMirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: 0 });

      const params = {
        spenderAccountId: spender,
        // 9_223_372_036_854_775_000 is safely below int64 max and within float64 precision
        tokenApprovals: [{ tokenId, amount: 9_223_372_036_854_775_000 }],
      };

      const res = await HederaParameterNormaliser.normaliseApproveTokenAllowance(
        params as any,
        mockContext,
        mockClient,
        mockMirrorNode,
      );

      expect(res.tokenApprovals).toHaveLength(1);
    });

    it('rejects overflow on the second token when the first is valid', async () => {
      mockMirrorNode.getTokenInfo
        .mockResolvedValueOnce({ decimals: 0 }) // first token: fine
        .mockResolvedValueOnce({ decimals: 0 }); // second token: will overflow

      const params = {
        spenderAccountId: spender,
        tokenApprovals: [
          { tokenId: '0.0.1', amount: 100 },
          { tokenId: '0.0.2', amount: 9_300_000_000_000_000_000 },
        ],
      };

      await expect(
        HederaParameterNormaliser.normaliseApproveTokenAllowance(
          params as any,
          mockContext,
          mockClient,
          mockMirrorNode,
        ),
      ).rejects.toThrow(/exceeds the HTS int64 maximum/);
    });

    it('includes the token id in the error message', async () => {
      mockMirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: 0 });

      const overflowTokenId = '0.0.9999';
      const params = {
        spenderAccountId: spender,
        tokenApprovals: [{ tokenId: overflowTokenId, amount: 9_300_000_000_000_000_000 }],
      };

      await expect(
        HederaParameterNormaliser.normaliseApproveTokenAllowance(
          params as any,
          mockContext,
          mockClient,
          mockMirrorNode,
        ),
      ).rejects.toThrow(new RegExp(overflowTokenId));
    });
  });
});
