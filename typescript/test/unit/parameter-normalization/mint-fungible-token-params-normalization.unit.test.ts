import { describe, it, expect, vi, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import type { Context } from '@/shared/configuration';

describe('HederaParameterNormaliser.normaliseMintFungibleTokenParams', () => {
  const mirrorNode = {
    getTokenInfo: vi.fn(),
  };
  const context = {} as Context;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly normalise amount using decimals from mirror node', async () => {
    mirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: '2' });

    const params: any = {
      tokenId: '0.0.1234',
      amount: 5, // represents 5.00 tokens with decimals=2
    };

    const result = await HederaParameterNormaliser.normaliseMintFungibleTokenParams(
      params,
      context,
      mirrorNode as any,
    );

    expect(mirrorNode.getTokenInfo).toHaveBeenCalledWith('0.0.1234');
    expect(result).toEqual({
      tokenId: '0.0.1234',
      amount: 500, // base units
    });
  });

  it('should handle decimals=0 correctly (no scaling)', async () => {
    mirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: '0' });

    const params: any = {
      tokenId: '0.0.2222',
      amount: 123,
    };

    const result = await HederaParameterNormaliser.normaliseMintFungibleTokenParams(
      params,
      context,
      mirrorNode as any,
    );

    expect(result).toEqual({
      tokenId: '0.0.2222',
      amount: 123,
    });
  });

  it('should default to 0 decimals if mirror node response is missing', async () => {
    mirrorNode.getTokenInfo.mockResolvedValueOnce({}); // no decimals field

    const params: any = {
      tokenId: '0.0.3333',
      amount: 10,
    };

    const result = await HederaParameterNormaliser.normaliseMintFungibleTokenParams(
      params,
      context,
      mirrorNode as any,
    );

    expect(result).toEqual({
      tokenId: '0.0.3333',
      amount: 10, // no scaling because decimals default to 0
    });
  });

  it('should throw if mirror node call fails', async () => {
    mirrorNode.getTokenInfo.mockRejectedValueOnce(new Error('Network error'));

    const params: any = {
      tokenId: '0.0.4444',
      amount: 1,
    };

    await expect(
      HederaParameterNormaliser.normaliseMintFungibleTokenParams(
        params,
        context,
        mirrorNode as any,
      ),
    ).rejects.toThrow('Network error');
  });
});
