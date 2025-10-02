import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, TokenId, TokenNftAllowance, Long } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

// Mock the AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HederaParameterNormaliser.normaliseApproveNftAllowance', () => {
  let mockContext: Context;
  let mockClient: Client;
  const operatorId = AccountId.fromString('0.0.5005').toString();

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {} as any;
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(operatorId);
  });

  it('normalises params with explicit owner, spender, tokenId, serials and memo', () => {
    const params = {
      ownerAccountId: '0.0.1111',
      spenderAccountId: '0.0.2222',
      tokenId: '0.0.7777',
      serialNumbers: [1, 2, 3],
      transactionMemo: 'approve NFT memo',
    };

    const res = HederaParameterNormaliser.normaliseApproveNftAllowance(
      params as any,
      mockContext,
      mockClient,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
      '0.0.1111',
      mockContext,
      mockClient,
    );

    expect(res.nftApprovals?.at(0)).toBeInstanceOf(TokenNftAllowance);

    const approval = res.nftApprovals![0] as TokenNftAllowance;
    expect(approval.ownerAccountId?.toString()).toBe(operatorId);
    expect(approval.spenderAccountId?.toString()).toBe('0.0.2222');
    expect(approval.tokenId?.toString()).toBe(TokenId.fromString('0.0.7777').toString());
    expect(approval.serialNumbers?.map(s => (s as Long).toNumber())).toEqual([1, 2, 3]);
    expect(res.transactionMemo).toBe('approve NFT memo');
  });

  it('defaults ownerAccountId using AccountResolver when not provided', () => {
    const params = {
      spenderAccountId: '0.0.3333',
      tokenId: '0.0.4444',
      serialNumbers: [10],
    };

    const res = HederaParameterNormaliser.normaliseApproveNftAllowance(
      params as any,
      mockContext,
      mockClient,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, mockContext, mockClient);

    const approval = res.nftApprovals![0] as TokenNftAllowance;
    expect(approval.ownerAccountId?.toString()).toBe(operatorId);
    expect(approval.spenderAccountId?.toString()).toBe('0.0.3333');
    expect(approval.tokenId?.toString()).toBe(TokenId.fromString('0.0.4444').toString());
    expect(approval.serialNumbers?.map(s => (s as Long).toNumber())).toEqual([10]);
  });

  it('throws when allSerials=true and serialNumbers are provided (mutually exclusive)', () => {
    const params = {
      ownerAccountId: '0.0.1111',
      spenderAccountId: '0.0.2222',
      tokenId: '0.0.7777',
      allSerials: true,
      serialNumbers: [1, 2],
    };

    expect(() =>
      HederaParameterNormaliser.normaliseApproveNftAllowance(
        params as any,
        mockContext,
        mockClient,
      ),
    ).toThrowError(/allSerials=true.*serialNumbers.*must not be provided/i);
  });

  it('throws when allSerials is not true and serialNumbers is empty or omitted', () => {
    const cases = [
      { spenderAccountId: '0.0.2222', tokenId: '0.0.7777', serialNumbers: [] },
      { spenderAccountId: '0.0.2222', tokenId: '0.0.7777' },
    ];

    for (const p of cases) {
      expect(() =>
        HederaParameterNormaliser.normaliseApproveNftAllowance(
          p as any,
          mockContext,
          mockClient,
        ),
      ).toThrowError(/serialNumbers must contain at least one serial/i);
    }
  });

  it('normalises approve-all with allSerials=true to TokenNftAllowance with allSerials=true and serialNumbers=null', () => {
    const params = {
      ownerAccountId: '0.0.1111',
      spenderAccountId: '0.0.2222',
      tokenId: '0.0.7777',
      allSerials: true,
      transactionMemo: 'approve all',
    } as any;

    const res = HederaParameterNormaliser.normaliseApproveNftAllowance(
      params,
      mockContext,
      mockClient,
    );

    const approval = res.nftApprovals![0] as TokenNftAllowance;
    expect(approval.allSerials).toBe(true);
    expect(approval.serialNumbers).toBeNull();
    expect(approval.tokenId?.toString()).toBe(TokenId.fromString('0.0.7777').toString());
  });
});
