import { describe, it, expect } from 'vitest';
import Long from 'long';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { toBaseUnit } from '@/shared/hedera-utils/decimals-utils';

describe('normaliseAirdropFungibleTokenParams Unit Tests', () => {
  const mockContext: any = { accountId: '0.0.1001' };
  const mockClient: any = {};
  const mockMirrorNode: any = {
    getTokenInfo: async () => ({ decimals: '2' }),
  };

  it('should normalise recipients correctly with base unit conversion', async () => {
    const params = {
      tokenId: '0.0.2001',
      sourceAccountId: '0.0.1001',
      recipients: [
        { accountId: '0.0.3001', amount: 5 }, // becomes 500 (5 * 10^2)
        { accountId: '0.0.3002', amount: 10 }, // becomes 1000
      ],
    };

    const result = await HederaParameterNormaliser.normaliseAirdropFungibleTokenParams(
      params,
      mockContext,
      mockClient,
      mockMirrorNode,
    );

    expect(result.tokenTransfers).toHaveLength(3); // 2 recipients + 1 sender
    expect(result.tokenTransfers[0].amount).toStrictEqual(
      Long.fromString(toBaseUnit(5, 2).toString()),
    );
    expect(result.tokenTransfers[1].amount).toStrictEqual(
      Long.fromString(toBaseUnit(10, 2).toString()),
    );
    expect(result.tokenTransfers[2].amount.toString()).toBe('-1500'); // total negated
  });

  it('should throw an error if recipient amount is <= 0', async () => {
    const params = {
      tokenId: '0.0.2001',
      sourceAccountId: '0.0.1001',
      recipients: [{ accountId: '0.0.3001', amount: 0 }],
    };

    await expect(
      HederaParameterNormaliser.normaliseAirdropFungibleTokenParams(
        params,
        mockContext,
        mockClient,
        mockMirrorNode,
      ),
    ).rejects.toThrow('Invalid recipient amount: 0');
  });
});
