import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, Hbar, Long } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

// Mock the AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HbarTransferNormalizer.normaliseTransferHbar', () => {
  let mockContext: Context;
  let mockClient: Client;
  const mockSourceAccountId = AccountId.fromString('0.0.1001').toString();

  // Helpers
  const hbar = (amount: number | string | Long) => new Hbar(amount);
  const tinybars = (amount: number | string | Long) => hbar(amount).toTinybars();
  const makeParams = (
    transfers: { accountId: string; amount: number }[],
    memo?: string,
    sourceId = '0.0.1001',
  ) => ({
    sourceAccountId: sourceId,
    transfers,
    transactionMemo: memo,
  });

  const sumTinybars = (amounts: number[]) =>
    amounts.reduce((acc, a) => acc.add(tinybars(a)), Long.ZERO);

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(mockSourceAccountId);
  });

  describe('Valid transfers', () => {
    it('should normalize a single HBAR transfer correctly', () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 10 }], 'Test transfer');

      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      expect(result.hbarTransfers[0]).toEqual({ accountId: '0.0.1002', amount: hbar(10) });
      expect(result.hbarTransfers[1]).toEqual({
        accountId: mockSourceAccountId,
        amount: Hbar.fromTinybars(tinybars(10).negate()),
      });
      expect(result.transactionMemo).toBe('Test transfer');
      expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
        '0.0.1001',
        mockContext,
        mockClient,
      );
    });

    it('should normalize multiple HBAR transfers correctly', () => {
      const params = makeParams(
        [
          { accountId: '0.0.1002', amount: 5 },
          { accountId: '0.0.1003', amount: 15 },
          { accountId: '0.0.1004', amount: 2.5 },
        ],
        'Multiple transfers',
      );

      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(4);

      const amounts = [5, 15, 2.5];
      result.hbarTransfers.slice(0, 3).forEach((t, i) => {
        expect(t).toEqual({ accountId: params.transfers[i].accountId, amount: hbar(amounts[i]) });
      });

      expect(result.hbarTransfers[3]).toEqual({
        accountId: mockSourceAccountId,
        amount: Hbar.fromTinybars(sumTinybars(amounts).negate()),
      });
    });

    it('should handle very small and fractional HBAR amounts correctly', () => {
      const smallAmount = 0.00000001;
      const params = makeParams([{ accountId: '0.0.1002', amount: smallAmount }]);

      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      expect((result.hbarTransfers[0].amount as Hbar).toTinybars()).toEqual(Long.fromNumber(1));
      expect((result.hbarTransfers[1].amount as Hbar).toTinybars()).toEqual(Long.fromNumber(-1));
    });

    it('should handle large HBAR amounts correctly', () => {
      const largeAmount = 50_000_000_000;
      const params = makeParams([{ accountId: '0.0.1002', amount: largeAmount }]);

      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      expect(result.hbarTransfers[0].amount.toString()).toBe(`${largeAmount} ℏ`);
      expect(result.hbarTransfers[1].amount.toString()).toBe(`-${largeAmount} ℏ`);
    });

    it('should handle transfers without memo', () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 1 }]);
      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );
      expect(result.transactionMemo).toBeUndefined();
    });
  });

  describe('Error conditions', () => {
    it.each([-5, 0])('should throw error for invalid transfer amount: %p', invalidAmount => {
      const params = makeParams([{ accountId: '0.0.1002', amount: invalidAmount }]);
      expect(() =>
        HederaParameterNormaliser.normaliseTransferHbar(params, mockContext, mockClient),
      ).toThrow(`Invalid transfer amount: ${invalidAmount}`);
    });

    it('should throw error when one of multiple transfers is invalid', () => {
      const params = makeParams([
        { accountId: '0.0.1002', amount: 5 },
        { accountId: '0.0.1003', amount: -2 },
        { accountId: '0.0.1004', amount: 3 },
      ]);

      expect(() =>
        HederaParameterNormaliser.normaliseTransferHbar(params, mockContext, mockClient),
      ).toThrow('Invalid transfer amount: -2');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty transfers array', () => {
      const params = makeParams([]);
      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(1);
      expect(result.hbarTransfers[0]).toEqual({
        accountId: mockSourceAccountId,
        amount: Hbar.fromTinybars(Long.ZERO),
      });
    });

    it('should preserve exact decimal precision', () => {
      const smallAmount = 0.12345678;
      const params = makeParams([{ accountId: '0.0.1002', amount: smallAmount }]);
      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      const expectedTinybars = tinybars(smallAmount);
      expect((result.hbarTransfers[0].amount as Hbar).toTinybars()).toEqual(expectedTinybars);
      expect((result.hbarTransfers[1].amount as Hbar).toTinybars()).toEqual(
        expectedTinybars.negate(),
      );
    });

    it('should call AccountResolver with correct parameters', () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 1 }], undefined, '0.0.9999');
      HederaParameterNormaliser.normaliseTransferHbar(params, mockContext, mockClient);

      expect(AccountResolver.resolveAccount).toHaveBeenCalledTimes(1);
      expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
        '0.0.9999',
        mockContext,
        mockClient,
      );
    });
  });

  describe('Balance verification', () => {
    it('should ensure total transfers sum to zero', () => {
      const params = makeParams([
        { accountId: '0.0.1002', amount: 10 },
        { accountId: '0.0.1003', amount: 5 },
        { accountId: '0.0.1004', amount: 15 },
      ]);

      const result = HederaParameterNormaliser.normaliseTransferHbar(
        params,
        mockContext,
        mockClient,
      );

      const total = result.hbarTransfers.reduce(
        (acc, t) => acc.add((t.amount as Hbar).toTinybars()),
        Long.ZERO,
      );
      expect(total.equals(Long.ZERO)).toBe(true);
    });
  });
});
