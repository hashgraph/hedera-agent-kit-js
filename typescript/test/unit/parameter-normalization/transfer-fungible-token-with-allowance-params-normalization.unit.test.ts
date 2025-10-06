import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

// ---- Mock dependencies ----
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn(),
  },
}));

describe('Transfer FT with allowance normalization', () => {
  let mockContext: Context;
  let mockClient: Client;
  const mockSourceAccountId = AccountId.fromString('0.0.1001').toString();
  const mockTokenId = '0.0.9999';

  const makeParams = (
    transfers: { accountId: string; amount: number }[],
    memo?: string,
    sourceId = '0.0.1001',
    tokenId = mockTokenId,
  ) => ({
    tokenId,
    sourceAccountId: sourceId,
    transfers,
    transactionMemo: memo,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(mockSourceAccountId);
  });

  describe('Valid transfers', () => {
    it('should normalise a single fungible token transfer with allowance correctly', () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 100 }], 'Token test');

      const result = HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
      );

      expect(result.tokenId).toBe(mockTokenId);
      expect(result.tokenTransfers).toHaveLength(1);
      expect(result.tokenTransfers[0]).toEqual(
        expect.objectContaining({
          accountId: '0.0.2002',
          amount: 100,
        }),
      );

      expect(result.approvedTransfer).toEqual(
        expect.objectContaining({
          ownerAccountId: mockSourceAccountId,
          amount: -100,
        }),
      );

      expect(result.transactionMemo).toBe('Token test');
    });

    it('should handle multiple recipients correctly', () => {
      const params = makeParams([
        { accountId: '0.0.2002', amount: 50 },
        { accountId: '0.0.3003', amount: 75 },
      ]);

      const result = HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
      );

      expect(result.tokenTransfers).toHaveLength(2);
      expect(result.tokenTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 50 }),
          expect.objectContaining({ accountId: '0.0.3003', amount: 75 }),
        ]),
      );

      expect(result.approvedTransfer.amount).toBe(-125);
    });
  });

  describe('Invalid transfers', () => {
    it('should throw if no transfers are provided', () => {
      const params = makeParams([]);
      expect(() =>
        HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
        ),
      ).toThrow(/transfer/i);
    });

    it('should throw on zero or negative amount', () => {
      const invalidParamsList = [
        makeParams([{ accountId: '0.0.2002', amount: 0 }]),
        makeParams([{ accountId: '0.0.2002', amount: -50 }]),
      ];

      for (const params of invalidParamsList) {
        expect(() =>
          HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
            params,
            mockContext,
            mockClient,
          ),
        ).toThrow(/Number must be greater than 0/);
      }
    });
  });
});
