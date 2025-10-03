import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId, Client, TokenId, TokenAllowance } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
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
});
