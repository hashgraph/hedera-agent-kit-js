import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, PrivateKey, PublicKey } from '@hiero-ledger/sdk';
import type { Context } from '@/shared/configuration';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn(),
    getDefaultPublicKey: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance', () => {
  let mockContext: Context;
  let mockClient: Client;
  let mockMirrornode: IHederaMirrornodeService;
  const mockSourceAccountId = AccountId.fromString('0.0.1001').toString();
  const mockTokenId = '0.0.9999';
  let OPERATOR_PUBLIC_KEY: PublicKey;

  const makeParams = (
    transfers: { accountId: string; amount: number }[],
    memo?: string,
    sourceId = '0.0.1001',
    tokenId = mockTokenId,
    schedulingParams?: any,
  ) => ({
    tokenId,
    sourceAccountId: sourceId,
    transfers,
    transactionMemo: memo,
    schedulingParams,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    const keypair = PrivateKey.generateED25519();
    OPERATOR_PUBLIC_KEY = keypair.publicKey;

    mockClient = {
      operatorPublicKey: {
        toStringDer: () => OPERATOR_PUBLIC_KEY.toStringDer(),
        toString: () => OPERATOR_PUBLIC_KEY.toString(),
      },
    } as unknown as Client;

    mockMirrornode = {
      getTokenInfo: vi.fn().mockResolvedValue({ decimals: 2 }),
    } as Partial<IHederaMirrornodeService> as IHederaMirrornodeService;
  });

  describe('Valid normalization', () => {
    it('should normalise a single fungible token transfer correctly', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 100 }], 'Test memo');

      const result = await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(mockMirrornode.getTokenInfo).toHaveBeenCalledWith(mockTokenId);
      expect(result.tokenId).toBe(mockTokenId);
      expect(result.tokenTransfers).toHaveLength(1);
      expect(result.tokenTransfers[0]).toEqual(
        expect.objectContaining({
          accountId: '0.0.2002',
          amount: 100 * 10 ** 2,
          tokenId: mockTokenId,
        }),
      );
      expect(result.approvedTransfer).toEqual(
        expect.objectContaining({
          ownerAccountId: mockSourceAccountId,
          amount: -100 * 10 ** 2,
        }),
      );
      expect(result.transactionMemo).toBe('Test memo');
      expect(result.schedulingParams?.isScheduled).toBe(false);
    });

    it('should normalise multiple transfers correctly and sum total amount', async () => {
      const params = makeParams([
        { accountId: '0.0.2002', amount: 50 },
        { accountId: '0.0.3003', amount: 75 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.tokenTransfers).toHaveLength(2);
      expect(result.tokenTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 50 * 10 ** 2 }),
          expect.objectContaining({ accountId: '0.0.3003', amount: 75 * 10 ** 2 }),
        ]),
      );
      expect(result.approvedTransfer.amount).toBe(-(125 * 10 ** 2));
      expect(result.schedulingParams?.isScheduled).toBe(false);
    });

    it('should handle scheduling parameters when provided', async () => {
      const params = makeParams(
        [{ accountId: '0.0.2002', amount: 50 }],
        'Scheduled memo',
        undefined,
        mockTokenId,
        { isScheduled: true, scheduleMemo: 'Scheduled memo' },
      );

      const result = await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.schedulingParams?.isScheduled).toBe(true);
    });
  });

  describe('Validation errors', () => {
    it('should throw an error if no transfers are provided', async () => {
      const params = makeParams([]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/transfer/i);
    });

    it('should throw an error if transfer amount is negative', async () => {
      const invalidParams = makeParams([{ accountId: '0.0.2002', amount: -50 }]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          invalidParams,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/Number must be greater than or equal to 0/i);
    });
  });

  describe('Transfer list balance (regression)', () => {
    // Helper: sum of credits (tokenTransfers) + the allowance debit
    const netBalance = (result: {
      tokenTransfers: { amount: number }[];
      approvedTransfer: { amount: number };
    }) =>
      result.tokenTransfers.reduce((acc, t) => acc + t.amount, 0) +
      result.approvedTransfer.amount;

    it('should produce a transfer list that nets to zero for 0.1 + 0.2 @ 8 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 8 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.1 },
        { accountId: '0.0.3003', amount: 0.2 },
      ]);

      const result =
        await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        );

      expect(netBalance(result)).toBe(0);
      expect(result.approvedTransfer.amount).toBe(
        -result.tokenTransfers.reduce((acc, t) => acc + t.amount, 0),
      );
    });

    it('should produce a transfer list that nets to zero for 1.5 @ 0 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 0 });
      const params = makeParams([{ accountId: '0.0.2002', amount: 1.5 }]);

      const result =
        await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        );

      // toBaseUnit floors: credit = floor(1.5) = 1, debit must be -1
      expect(result.tokenTransfers[0].amount).toBe(1);
      expect(result.approvedTransfer.amount).toBe(-1);
      expect(netBalance(result)).toBe(0);
    });

    it('should produce a transfer list that nets to zero for 0.001 × 2 @ 2 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 2 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.001 },
        { accountId: '0.0.3003', amount: 0.001 },
      ]);

      const result =
        await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        );

      expect(netBalance(result)).toBe(0);
    });

    it('should produce a transfer list that nets to zero for three fractional recipients @ 8 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 8 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.1 },
        { accountId: '0.0.3003', amount: 0.2 },
        { accountId: '0.0.4004', amount: 0.3 },
      ]);

      const result =
        await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        );

      expect(netBalance(result)).toBe(0);
      expect(result.approvedTransfer.amount).toBe(
        -result.tokenTransfers.reduce((acc, t) => acc + t.amount, 0),
      );
    });
  });
});
