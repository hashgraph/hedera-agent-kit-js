import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, PrivateKey, PublicKey } from '@hiero-ledger/sdk';
import Long from 'long';
import { AgentMode } from '@/shared/configuration';
import type { Context } from '@/shared/configuration';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

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
      operatorAccountId: { toString: () => '0.0.1001' },
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
      expect(result.tokenTransfers[0].accountId).toBe('0.0.2002');
      expect(result.tokenTransfers[0].tokenId).toBe(mockTokenId);
      expect(result.tokenTransfers[0].amount.toString()).toBe(
        Long.fromNumber(100 * 10 ** 2).toString(),
      );
      expect(result.approvedTransfer).toMatchObject({ ownerAccountId: mockSourceAccountId });
      expect(result.approvedTransfer.amount.toString()).toBe(
        Long.fromNumber(-(100 * 10 ** 2)).toString(),
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
      const amounts = result.tokenTransfers.map(t => t.amount.toString());
      expect(amounts).toContain(Long.fromNumber(50 * 10 ** 2).toString());
      expect(amounts).toContain(Long.fromNumber(75 * 10 ** 2).toString());
      // owner debit must equal the exact sum of credits (no float drift)
      expect(result.approvedTransfer.amount.toString()).toBe(
        Long.fromNumber(-(125 * 10 ** 2)).toString(),
      );
      expect(result.schedulingParams?.isScheduled).toBe(false);
    });

    it('owner debit equals exact Long sum of credits for large recipient amounts', async () => {
      // Use 0 decimals so display amount == base amount, making the assertion easy.
      mockMirrornode.getTokenInfo = vi.fn().mockResolvedValue({ decimals: 0 });

      // Two recipients whose amounts are above Number.MAX_SAFE_INTEGER territory
      // when summed, but each individually fits in int64.
      const a = 4_000_000_000_000_000; // 4e15 (above 2^52 but below 2^53)
      const b = 4_000_000_000_000_000;
      const params = makeParams([
        { accountId: '0.0.2002', amount: a },
        { accountId: '0.0.3003', amount: b },
      ]);

      const result = await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        mockContext,
        mockClient,
        mockMirrornode,
      );

      const expectedDebit = Long.fromNumber(a).add(Long.fromNumber(b)).negate();
      expect(result.approvedTransfer.amount.toString()).toBe(expectedDebit.toString());
    });

    it('should handle scheduling parameters when provided', async () => {
      // Use AUTONOMOUS mode so getDefaultPublicKey returns client.operatorPublicKey directly
      // without a mirror-node round-trip (no mirrorNode needed in this test).
      const schedulingContext: Context = { mode: AgentMode.AUTONOMOUS, accountId: '0.0.1001' };
      const params = makeParams(
        [{ accountId: '0.0.2002', amount: 50 }],
        'Scheduled memo',
        undefined,
        mockTokenId,
        { isScheduled: true, scheduleMemo: 'Scheduled memo' },
      );

      const result = await HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
        params,
        schedulingContext,
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

  describe('HTS int64 overflow guard', () => {
    it('rejects a recipient amount whose base-unit value exceeds int64 max', async () => {
      mockMirrornode.getTokenInfo = vi.fn().mockResolvedValue({ decimals: 0 });

      // 9.3e18 > Long.MAX_VALUE = 9_223_372_036_854_775_807
      const params = makeParams([{ accountId: '0.0.2002', amount: 9_300_000_000_000_000_000 }]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/exceeds the HTS int64 maximum/);
    });

    it('rejects overflow on a second recipient when the first is valid', async () => {
      mockMirrornode.getTokenInfo = vi.fn().mockResolvedValue({ decimals: 0 });

      const params = makeParams([
        { accountId: '0.0.2002', amount: 100 },
        { accountId: '0.0.3003', amount: 9_300_000_000_000_000_000 },
      ]);

      await expect(
        HederaParameterNormaliser.normaliseTransferFungibleTokenWithAllowance(
          params,
          mockContext,
          mockClient,
          mockMirrornode,
        ),
      ).rejects.toThrow(/exceeds the HTS int64 maximum/);
    });
  });
});
