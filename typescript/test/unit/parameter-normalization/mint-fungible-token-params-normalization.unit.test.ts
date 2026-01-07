import { describe, it, expect, vi, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import type { Context } from '@/shared/configuration';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { AccountResolver } from '@/shared';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(),
    getDefaultPublicKey: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseMintFungibleTokenParams', () => {
  const mirrorNode = {
    getTokenInfo: vi.fn(),
  };
  const context = {} as Context;
  let client: any;
  let OPERATOR_PUBLIC_KEY: PublicKey;

  beforeEach(() => {
    vi.clearAllMocks();

    const keypair = PrivateKey.generateED25519();
    OPERATOR_PUBLIC_KEY = keypair.publicKey;

    client = {
      operatorPublicKey: {
        toStringDer: () => OPERATOR_PUBLIC_KEY.toStringDer(),
        toString: () => OPERATOR_PUBLIC_KEY.toString(),
      },
    };
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
      client,
      mirrorNode as any,
    );

    expect(mirrorNode.getTokenInfo).toHaveBeenCalledWith('0.0.1234');
    expect(result).toEqual({
      tokenId: '0.0.1234',
      amount: 500, // base units
      schedulingParams: { isScheduled: false },
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
      client,
      mirrorNode as any,
    );

    expect(result).toEqual({
      tokenId: '0.0.2222',
      amount: 123,
      schedulingParams: { isScheduled: false },
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
      client,
      mirrorNode as any,
    );

    expect(result).toEqual({
      tokenId: '0.0.3333',
      amount: 10, // no scaling because decimals default to 0
      schedulingParams: { isScheduled: false },
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
        client,
        mirrorNode as any,
      ),
    ).rejects.toThrow('Network error');
  });

  it('supports scheduling parameters when provided', async () => {
    mirrorNode.getTokenInfo.mockResolvedValueOnce({ decimals: '2' });
    const adminKeyPair = PrivateKey.generateED25519();
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.6666');
    (AccountResolver.getDefaultPublicKey as any).mockResolvedValue(
      adminKeyPair.publicKey.toStringDer(),
    );

    const params: any = {
      tokenId: '0.0.5555',
      amount: 10,
      schedulingParams: {
        isScheduled: true,
        adminKey: true,
        payerAccountId: '0.0.7777',
        waitForExpiry: true,
      },
    };

    const result = await HederaParameterNormaliser.normaliseMintFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.tokenId).toBe('0.0.5555');
    expect(result.amount).toBe(1000); // scaled by decimals=2
    expect(result.schedulingParams?.isScheduled).toBe(true);
    expect(result.schedulingParams?.payerAccountID?.toString()).toBe('0.0.7777');
    expect(result.schedulingParams?.waitForExpiry).toBe(true);
  });
});
