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
    isScheduled: boolean = false,
  ) => ({
    sourceAccountId: sourceId,
    transfers,
    transactionMemo: memo,
    schedulingParams: isScheduled ? { isScheduled: false } : undefined,
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
    it('should normalize a single HBAR transfer correctly', async () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 10 }], 'Test transfer');

      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
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

    it('should normalize multiple HBAR transfers correctly', async () => {
      const params = makeParams(
        [
          { accountId: '0.0.1002', amount: 5 },
          { accountId: '0.0.1003', amount: 15 },
          { accountId: '0.0.1004', amount: 2.5 },
        ],
        'Multiple transfers',
      );

      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
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

    it('should handle very small and fractional HBAR amounts correctly', async () => {
      const smallAmount = 0.00000001;
      const params = makeParams([{ accountId: '0.0.1002', amount: smallAmount }]);

      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      expect((result.hbarTransfers[0].amount as Hbar).toTinybars()).toEqual(Long.fromNumber(1));
      expect((result.hbarTransfers[1].amount as Hbar).toTinybars()).toEqual(Long.fromNumber(-1));
    });

    it('should handle large HBAR amounts correctly', async () => {
      const largeAmount = 50_000_000_000;
      const params = makeParams([{ accountId: '0.0.1002', amount: largeAmount }]);

      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      expect(result.hbarTransfers[0].amount.toString()).toBe(`${largeAmount} ℏ`);
      expect(result.hbarTransfers[1].amount.toString()).toBe(`-${largeAmount} ℏ`);
    });

    it('should handle transfers without memo', async () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 1 }]);
      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
        mockContext,
        mockClient,
      );
      expect(result.transactionMemo).toBeUndefined();
    });
  });

  describe('Error conditions', () => {
    it.each([-5, 0])('should throw error for invalid transfer amount: %p', async invalidAmount => {
      const params = makeParams([{ accountId: '0.0.1002', amount: invalidAmount }]);
      await expect(
        HederaParameterNormaliser.normaliseTransferHbar(params as any, mockContext, mockClient),
      ).rejects.toThrow(`Invalid transfer amount: ${invalidAmount}`);
    });

    it('should throw error when one of multiple transfers is invalid', async () => {
      const params = makeParams([
        { accountId: '0.0.1002', amount: 5 },
        { accountId: '0.0.1003', amount: -2 },
        { accountId: '0.0.1004', amount: 3 },
      ]);

      await expect(
        HederaParameterNormaliser.normaliseTransferHbar(params as any, mockContext, mockClient),
      ).rejects.toThrow('Invalid transfer amount: -2');
    });
  });

  describe('Edge cases', () => {
    it('should preserve exact decimal precision', async () => {
      const smallAmount = 0.12345678;
      const params = makeParams([{ accountId: '0.0.1002', amount: smallAmount }]);
      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
        mockContext,
        mockClient,
      );

      const expectedTinybars = tinybars(smallAmount);
      expect((result.hbarTransfers[0].amount as Hbar).toTinybars()).toEqual(expectedTinybars);
      expect((result.hbarTransfers[1].amount as Hbar).toTinybars()).toEqual(
        expectedTinybars.negate(),
      );
    });

    it('should call AccountResolver with correct parameters', async () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 1 }], undefined, '0.0.9999');
      await HederaParameterNormaliser.normaliseTransferHbar(params as any, mockContext, mockClient);

      expect(AccountResolver.resolveAccount).toHaveBeenCalledTimes(1);
      expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
        '0.0.9999',
        mockContext,
        mockClient,
      );
    });
  });

  describe('Balance verification', () => {
    it('should ensure total transfers sum to zero', async () => {
      const params = makeParams([
        { accountId: '0.0.1002', amount: 10 },
        { accountId: '0.0.1003', amount: 5 },
        { accountId: '0.0.1004', amount: 15 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferHbar(
        params as any,
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
