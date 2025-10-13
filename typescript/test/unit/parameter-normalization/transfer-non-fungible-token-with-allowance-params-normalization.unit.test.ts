import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId, NftId } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { transferNonFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { z } from 'zod';

describe('HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance', () => {
  let mockContext: Context;
  const mockSourceAccountId = AccountId.fromString('0.0.1001').toString();

  const makeParams = (
    recipients: { recipientId: string; serialNumber: number }[],
    tokenId = '0.0.2001',
    memo?: string,
  ): z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParameters>> => ({
    sourceAccountId: mockSourceAccountId,
    tokenId,
    recipients,
    transactionMemo: memo,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
  });

  describe('Valid NFT allowance transfers', () => {
    it('should normalise a single NFT transfer correctly', () => {
      const params = makeParams(
        [{ recipientId: '0.0.3001', serialNumber: 1 }],
        '0.0.2001',
        'NFT xfer',
      );

      const result = HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(
        params,
        mockContext,
      );

      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0]).toEqual(
        expect.objectContaining({
          nftId: expect.any(NftId),
          receiver: AccountId.fromString('0.0.3001'),
        }),
      );

      expect(result.transactionMemo).toBe('NFT xfer');
    });

    it('should handle multiple NFT recipients', () => {
      const params = makeParams([
        { recipientId: '0.0.3001', serialNumber: 1 },
        { recipientId: '0.0.3002', serialNumber: 2 },
      ]);

      const result = HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(
        params,
        mockContext,
      );

      expect(result.transfers).toHaveLength(2);
      expect(result.transfers.map(t => t.nftId.serial.toString())).toEqual(['1', '2']);
    });
  });

  describe('Invalid inputs', () => {
    it('should throw if no recipients provided', () => {
      const params = makeParams([]);
      expect(() =>
        HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(
          params,
          mockContext,
        ),
      ).toThrow(/recipient/i);
    });

    it('should throw if serialNumber is invalid', () => {
      const invalids = [
        makeParams([{ recipientId: '0.0.1002', serialNumber: 0 }]),
        makeParams([{ recipientId: '0.0.1002', serialNumber: -3 }]),
      ];

      for (const p of invalids) {
        expect(() =>
          HederaParameterNormaliser.normaliseTransferNonFungibleTokenWithAllowance(p, mockContext),
        ).toThrow(/Number must be greater than 0/i);
      }
    });
  });
});
