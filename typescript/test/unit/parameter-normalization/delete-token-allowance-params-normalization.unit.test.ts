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

describe('HederaParameterNormaliser.normaliseDeleteTokenAllowance', () => {
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

  it('normalizes params with explicit owner, multiple tokenIds, and memo', async () => {
    const params = {
      ownerAccountId: resolvedOwner,
      spenderAccountId: spender,
      tokenIds: ['0.0.111', '0.0.222'],
      transactionMemo: 'delete FT allowance',
    };

    const res = await HederaParameterNormaliser.normaliseDeleteTokenAllowance(
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

    expect(res.tokenApprovals?.length).toBe(2);
    res.tokenApprovals!.forEach(a => {
      expect(a.ownerAccountId!.toString()).toBe(resolvedOwner);
      expect(a.spenderAccountId!.toString()).toBe(spender);
      expect(Long.isLong(a.amount)).toBe(true);
      // Delete always sets amount = 0
      expect(a.amount!.toString()).toBe('0');
    });

    expect(res.transactionMemo).toBe('delete FT allowance');
  });

  it('defaults ownerAccountId using AccountResolver when not provided', async () => {
    const params = {
      spenderAccountId: spender,
      tokenIds: [tokenId],
    };

    const res = await HederaParameterNormaliser.normaliseDeleteTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, mockContext, mockClient);
    const a = res.tokenApprovals![0];
    expect(a.ownerAccountId!.toString()).toBe(resolvedOwner);
    expect(a.spenderAccountId!.toString()).toBe(spender);
    expect(a.tokenId.toString()).toBe(TokenId.fromString(tokenId).toString());
    expect(a.amount!.toString()).toBe('0');
  });

  it('always sets amount to 0 regardless of extraneous input', async () => {
    const params = {
      spenderAccountId: spender,
      tokenIds: [tokenId],
      amount: 9999, // ignored
    };

    const res = await HederaParameterNormaliser.normaliseDeleteTokenAllowance(
      params as any,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    const a = res.tokenApprovals![0] as TokenAllowance;
    expect(a.amount!.toString()).toBe('0');
  });

  it('supports multiple tokenIds and generates matching allowances with amount=0', async () => {
    const params = {
      spenderAccountId: spender,
      tokenIds: ['0.0.1', '0.0.2', '0.0.3'],
    };

    const res = await HederaParameterNormaliser.normaliseDeleteTokenAllowance(
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
    expect(res.tokenApprovals?.map(a => a.amount!.toString())).toEqual(['0', '0', '0']);
  });
});
