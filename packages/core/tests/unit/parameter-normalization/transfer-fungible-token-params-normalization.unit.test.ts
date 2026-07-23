import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, PrivateKey, PublicKey } from '@hiero-ledger/sdk';
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
vi.mock('@/shared/utils/token-unit-utils', () => ({
  toBaseUnit: vi.fn((amount: number, decimals: number) => ({
    toNumber: () => amount * Math.pow(10, decimals),
  })),
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
      expect(result.tokenTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 100 * 10 ** 2 }),
        ]),
      );
      // sender debit
      expect(result.tokenTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: -(100 * 10 ** 2) }),
        ]),
      );
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
      expect(result.tokenTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 50 * 10 ** 2 }),
          expect.objectContaining({ accountId: '0.0.3003', amount: 75 * 10 ** 2 }),
          expect.objectContaining({ amount: -(125 * 10 ** 2) }),
        ]),
      );
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

      const debitEntry = result.tokenTransfers.find((t: any) => (t.amount as number) < 0);
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

      const debitEntry = result.tokenTransfers.find((t: any) => (t.amount as number) < 0);
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

      const creditEntry = result.tokenTransfers.find((t: any) => (t.amount as number) > 0);
      expect(creditEntry?.amount).toBe(10 ** 6);
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
});
