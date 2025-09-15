import { describe, it, expect } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

describe('HederaParameterNormaliser.normaliseMintNonFungibleTokenParams', () => {
  const context: any = {};

  it('encodes URIs into Uint8Array metadata', () => {
    const params: any = {
      tokenId: '0.0.1234',
      uris: ['ipfs://abc123', 'https://example.com/meta.json'],
    };

    const result = HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(params, context);

    expect(result.tokenId).toBe('0.0.1234');
    expect(result.uris).toEqual(params.uris);
    expect(result.metadata).toHaveLength(2);

    const decoder = new TextDecoder();
    expect(decoder.decode(result.metadata[0])).toBe('ipfs://abc123');
    expect(decoder.decode(result.metadata[1])).toBe('https://example.com/meta.json');
  });

  it('handles empty URIs array gracefully', () => {
    const params: any = {
      tokenId: '0.0.5678',
      uris: [],
    };

    const result = HederaParameterNormaliser.normaliseMintNonFungibleTokenParams(params, context);

    expect(result.tokenId).toBe('0.0.5678');
    expect(result.metadata).toEqual([]);
  });
});
