import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, Hbar, Long } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HbarTransferWithAllowanceNormalizer.normaliseTransferHbarWithAllowance', () => {
  let mockContext: Context;
  let mockClient: Client;
  const mockSourceAccountId = AccountId.fromString('0.0.1001').toString();

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(mockSourceAccountId);
  });

  describe('Valid transfers', () => {
    it('should normalize a single HBAR transfer with allowance correctly', () => {
      const params = makeParams([{ accountId: '0.0.1002', amount: 10 }], 'Test transfer');

      const result = HederaParameterNormaliser.normaliseTransferHbarWithAllowance(
        params,
        mockContext,
        mockClient,
      );

      // Expect recipient transfer only in hbarTransfers
      expect(result.hbarTransfers).toHaveLength(1);
      expect(result.hbarTransfers[0]).toEqual(
        expect.objectContaining({
          accountId: '0.0.1002',
          amount: expect.any(Hbar),
        }),
      );
      expect((result.hbarTransfers[0].amount as Hbar).toTinybars()).toEqual(tinybars(10));

      // Expect owner’s approved transfer (negative)
      expect(result.hbarApprovedTransfer.ownerAccountId).toBe(mockSourceAccountId);
      expect(result.hbarApprovedTransfer.amount.toTinybars()).toEqual(tinybars(-10));

      expect(result.transactionMemo).toBe('Test transfer');
    });

    it('should handle multiple recipient transfers correctly', () => {
      const params = makeParams([
        { accountId: '0.0.2002', amount: 5 },
        { accountId: '0.0.3003', amount: 7 },
      ]);

      const result = HederaParameterNormaliser.normaliseTransferHbarWithAllowance(
        params,
        mockContext,
        mockClient,
      );

      expect(result.hbarTransfers).toHaveLength(2);
      const totalTinybars = tinybars(5).add(tinybars(7));

      expect(result.hbarApprovedTransfer.ownerAccountId).toBe(mockSourceAccountId);
      expect(result.hbarApprovedTransfer.amount.toTinybars()).toEqual(totalTinybars.negate());
    });
  });

  describe('Invalid transfers', () => {
    it('should throw if no transfers are provided', () => {
      const params = makeParams([]);
      expect(() =>
        HederaParameterNormaliser.normaliseTransferHbarWithAllowance(
          params,
          mockContext,
          mockClient,
        ),
      ).toThrow(/transfer/i);
    });

    it('should throw on zero or negative amount', () => {
      const invalidParamsList = [
        makeParams([{ accountId: '0.0.1002', amount: 0 }]),
        makeParams([{ accountId: '0.0.1002', amount: -5 }]),
      ];

      for (const params of invalidParamsList) {
        expect(() =>
          HederaParameterNormaliser.normaliseTransferHbarWithAllowance(
            params,
            mockContext,
            mockClient,
          ),
        ).toThrow(/Invalid transfer amount/);
      }
    });
  });
});
