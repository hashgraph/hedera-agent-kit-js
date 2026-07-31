import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, Long, PrivateKey, PublicKey } from '@hiero-ledger/sdk';
import type { Context } from '@/shared/configuration';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn((accountId: string | undefined, _ctx: any, _client: any) =>
      accountId ?? '0.0.1001',
    ),
    getDefaultPublicKey: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseTransferFungibleToken', () => {
  let mockContext: Context;
  let mockClient: Client;
  let mockMirrornode: IHederaMirrornodeService;
  const mockTokenId = '0.0.9999';
  let OPERATOR_PUBLIC_KEY: PublicKey;

  const makeParams = (
    transfers: { accountId: string; amount: number }[],
    memo?: string,
    senderId?: string,
    tokenId = mockTokenId,
    schedulingParams?: any,
  ) => ({
    tokenId,
    senderAccountId: senderId,
    transfers,
    transactionMemo: memo,
    schedulingParams,
  });

  const isNegativeLongOrNumber = (v: Long | number): boolean =>
    Long.isLong(v) ? (v as Long).isNegative() : (v as number) < 0;

  const isPositiveLongOrNumber = (v: Long | number): boolean =>
    Long.isLong(v) ? !(v as Long).isNegative() && !(v as Long).isZero() : (v as number) > 0;

  const toLongOrNumber = (v: Long | number): number =>
    Long.isLong(v) ? (v as Long).toNumber() : (v as number);

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
    it('should normalise a single recipient transfer correctly', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 100 }], 'Test memo');

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(mockMirrornode.getTokenInfo).toHaveBeenCalledWith(mockTokenId);
      expect(result.tokenId).toBe(mockTokenId);
      expect(result.transactionMemo).toBe('Test memo');
      expect(result.schedulingParams?.isScheduled).toBe(false);

      // recipient credit
      const creditEntry = result.tokenTransfers.find((t: any) => t.accountId === '0.0.2002');
      expect(creditEntry?.amount.toString()).toBe(String(100 * 10 ** 2));
      // sender debit
      const debitEntry = result.tokenTransfers.find((t: any) => isNegativeLongOrNumber(t.amount));
      expect(debitEntry?.amount.toString()).toBe(String(-(100 * 10 ** 2)));
    });

    it('should include sender debit entry equal to negative sum of recipient amounts', async () => {
      const params = makeParams([
        { accountId: '0.0.2002', amount: 50 },
        { accountId: '0.0.3003', amount: 75 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.tokenTransfers).toHaveLength(3); // 2 credits + 1 debit

      const entry2002 = result.tokenTransfers.find((t: any) => t.accountId === '0.0.2002');
      const entry3003 = result.tokenTransfers.find((t: any) => t.accountId === '0.0.3003');
      const debit = result.tokenTransfers.find((t: any) => isNegativeLongOrNumber(t.amount));

      expect(entry2002?.amount.toString()).toBe(String(50 * 10 ** 2));
      expect(entry3003?.amount.toString()).toBe(String(75 * 10 ** 2));
      expect(debit?.amount.toString()).toBe(String(-(125 * 10 ** 2)));
    });

    it('should use explicit senderAccountId when provided', async () => {
      const params = makeParams(
        [{ accountId: '0.0.2002', amount: 10 }],
        undefined,
        '0.0.5555',
      );

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      const debitEntry = result.tokenTransfers.find((t: any) => isNegativeLongOrNumber(t.amount));
      expect(debitEntry?.accountId).toBe('0.0.5555');
    });

    it('should default senderAccountId to operator when omitted', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 10 }]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      const debitEntry = result.tokenTransfers.find((t: any) => isNegativeLongOrNumber(t.amount));
      // AccountResolver.resolveAccount returns '0.0.1001' for undefined
      expect(debitEntry?.accountId).toBe('0.0.1001');
    });

    it('should apply token decimals from mirrornode when converting amounts', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 6 });
      const params = makeParams([{ accountId: '0.0.2002', amount: 1 }]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      const creditEntry = result.tokenTransfers.find((t: any) => isPositiveLongOrNumber(t.amount));
      expect(creditEntry?.amount.toString()).toBe(String(10 ** 6));
    });

    it('should handle scheduling parameters when isScheduled is true', async () => {
      const params = makeParams(
        [{ accountId: '0.0.2002', amount: 50 }],
        'Scheduled memo',
        undefined,
        mockTokenId,
        { isScheduled: true, waitForExpiry: false, adminKey: false },
      );

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.schedulingParams?.isScheduled).toBe(true);
    });

    it('should propagate transactionMemo when provided', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 10 }], 'my memo');

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.transactionMemo).toBe('my memo');
    });

    it('should set transactionMemo to undefined when not provided', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: 10 }]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(result.transactionMemo).toBeUndefined();
    });
  });

  describe('Validation errors', () => {
    it('should throw when transfers array is empty', async () => {
      const params = makeParams([]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleToken(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/transfer/i);
    });

    it('should throw when transfer amount is negative', async () => {
      const params = makeParams([{ accountId: '0.0.2002', amount: -50 }]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleToken(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/Number must be greater than or equal to 0/i);
    });
  });

  describe('Transfer list balance (regression)', () => {
    const sumAmounts = (ts: { amount: Long | number }[]) =>
      ts.reduce((acc, t) => acc + toLongOrNumber(t.amount), 0);

    it('should produce a transfer list that nets to zero for 0.1 + 0.2 @ 8 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 8 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.1 },
        { accountId: '0.0.3003', amount: 0.2 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(sumAmounts(result.tokenTransfers)).toBe(0);
    });

    it('should produce a transfer list that nets to zero for 1.5 @ 0 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 0 });
      const params = makeParams([{ accountId: '0.0.2002', amount: 1.5 }]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      // toBaseUnit floors: credit = floor(1.5) = 1, debit must be -1
      const credit = result.tokenTransfers.find((t: any) => isPositiveLongOrNumber(t.amount));
      const debit = result.tokenTransfers.find((t: any) => isNegativeLongOrNumber(t.amount));
      expect(credit?.amount.toString()).toBe('1');
      expect(debit?.amount.toString()).toBe('-1');
      expect(sumAmounts(result.tokenTransfers)).toBe(0);
    });

    it('should produce a transfer list that nets to zero for 0.001 × 2 @ 2 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 2 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.001 },
        { accountId: '0.0.3003', amount: 0.001 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(sumAmounts(result.tokenTransfers)).toBe(0);
    });

    it('should produce a transfer list that nets to zero for three fractional recipients @ 8 decimals', async () => {
      (mockMirrornode.getTokenInfo as any).mockResolvedValue({ decimals: 8 });
      const params = makeParams([
        { accountId: '0.0.2002', amount: 0.1 },
        { accountId: '0.0.3003', amount: 0.2 },
        { accountId: '0.0.4004', amount: 0.3 },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleToken(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      expect(sumAmounts(result.tokenTransfers)).toBe(0);
    });
  });
});
