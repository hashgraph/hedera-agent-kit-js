import { describe, it, expect, beforeEach, vi } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { AccountResolver } from '@/shared/utils/account-resolver';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultPublicKey: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseMintNonFungibleTokenParams', () => {
  let OPERATOR_PUBLIC_KEY: PublicKey;
  const context: any = { accountId: '0.0.1001' };
  let client: any;

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

    // Mock getDefaultPublicKey to prevent the runtime error
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValue(OPERATOR_PUBLIC_KEY);
  });

  it('encodes URIs into Uint8Array metadata', async () => {
    const params: any = {
      tokenId: '0.0.1234',
      uris: ['ipfs://abc123', 'https://example.com/meta.json'],
    };

    const result = await HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(
      params,
      context,
      client,
    );

    expect(result.tokenId).toBe('0.0.1234');
    expect(result.metadata).toHaveLength(2);

    const decoder = new TextDecoder();
    expect(decoder.decode(result.metadata![0])).toBe(params.uris[0]);
    expect(decoder.decode(result.metadata![1])).toBe(params.uris[1]);
  });

  it('handles empty URIs array gracefully', async () => {
    const params: any = {
      tokenId: '0.0.5678',
      uris: [],
    };

    const result = await HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(
      params,
      context,
      client,
    );

    expect(result.tokenId).toBe('0.0.5678');
    expect(result.metadata).toEqual([]);
  });

  it('supports scheduling parameters when provided', async () => {
    const params: any = {
      tokenId: '0.0.9999',
      uris: ['ipfs://scheduled'],
      schedulingParams: { isScheduled: true },
    };

    const result = await HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(
      params,
      context,
      client,
    );

    expect(result.tokenId).toBe('0.0.9999');
    expect(result.schedulingParams?.isScheduled).toBe(true);
    expect(result.metadata).toHaveLength(1);
    const decoder = new TextDecoder();
    expect(decoder.decode(result.metadata![0])).toBe('ipfs://scheduled');
  });
});
