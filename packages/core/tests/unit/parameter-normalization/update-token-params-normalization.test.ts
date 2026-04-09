import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenId, AccountId, PublicKey, PrivateKey } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { z } from 'zod';
import { AccountResolver } from '@/shared/utils/account-resolver';
import { updateTokenParameters } from '@/shared/parameter-schemas/token.zod';

// Mock AccountResolver and HederaParameterNormaliser.resolveKey
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultPublicKey: vi.fn(async (_context: any, _client: any) =>
      PublicKey.fromString(
        '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2',
      ),
    ),
  },
}));

describe('HederaParameterNormaliser.normaliseUpdateToken', () => {
  const context: any = { accountId: '0.0.5005' };
  const client: any = { operatorAccountId: AccountId.fromString('0.0.5005') };
  const mockUserPublicKey = PublicKey.fromString(
    '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2',
  );

  beforeEach(() => {
    vi.clearAllMocks();
    (AccountResolver.getDefaultPublicKey as any).mockResolvedValue(mockUserPublicKey);
    // Spy on the actual resolveKey method if we want to ensure it's called with correct arguments
    vi.spyOn(HederaParameterNormaliser as any, 'resolveKey');
  });

  it('normalizes tokenId and includes only provided fields (no keys, no other optional props)', async () => {
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.123',
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;

    expect(AccountResolver.getDefaultPublicKey).toHaveBeenCalledWith(context, client);
    expect(res.tokenId).toBeInstanceOf(TokenId);
    expect(res.tokenId.toString()).toBe('0.0.123');
    expect(Object.keys(res).length).toBe(1); // Only tokenId should be present
  });

  it('normalizes tokenId and includes provided optional string/boolean fields', async () => {
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.123',
      tokenName: 'My Awesome Token',
      tokenSymbol: 'MAT',
      treasuryAccountId: '0.0.789',
      tokenMemo: 'Some memo',
      metadata: '{"key":"value"}',
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;

    expect(res.tokenId.toString()).toBe('0.0.123');
    expect(res.tokenName).toBe('My Awesome Token');
    expect(res.tokenSymbol).toBe('MAT');
    expect(res.treasuryAccountId).toBe('0.0.789');
    expect(res.tokenMemo).toBe('Some memo');
    expect(res.metadata).toEqual(new TextEncoder().encode('{"key":"value"}'));
    expect(Object.prototype.hasOwnProperty.call(res, 'adminKey')).toBe(false); // Keys aren't provided
  });

  it('normalizes keys: adminKey (true), supplyKey (string), wipeKey (false)', async () => {
    const specificKey = PrivateKey.generateED25519().publicKey.toStringDer();
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.123',
      adminKey: true,
      supplyKey: specificKey,
      wipeKey: false,
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;

    expect(HederaParameterNormaliser['resolveKey']).toHaveBeenCalledWith(true, mockUserPublicKey);
    expect(HederaParameterNormaliser['resolveKey']).toHaveBeenCalledWith(
      specificKey,
      mockUserPublicKey,
    );
    expect(HederaParameterNormaliser['resolveKey']).toHaveBeenCalledWith(false, mockUserPublicKey);

    expect(res.tokenId.toString()).toBe('0.0.123');
    expect(res.adminKey).toBeInstanceOf(PublicKey);
    expect(res.adminKey.toString()).toBe(mockUserPublicKey.toString()); // 'true' should resolve to a default public key
    expect(res.supplyKey).toBeInstanceOf(PublicKey);
    expect(res.supplyKey.toStringDer()).toBe(specificKey);
    expect(Object.prototype.hasOwnProperty.call(res, 'freezeKey')).toBe(false); // Other keys not provided
  });

  it('handles a mix of optional fields and various key types', async () => {
    const specificSupplyKey =
      '302a300506032b65700321001111111111222222222233333333334444444444555555555566666666667777';
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.456',
      tokenName: 'Hybrid Token',
      freezeKey: true,
      supplyKey: specificSupplyKey,
      kycKey: false,
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;

    expect(res.tokenId.toString()).toBe('0.0.456');
    expect(res.tokenName).toBe('Hybrid Token');
    expect(res.freezeKey).toBeInstanceOf(PublicKey);
    expect(res.freezeKey.toString()).toBe(mockUserPublicKey.toString());
    expect(res.supplyKey).toBeInstanceOf(PublicKey);
    expect(res.supplyKey.toString()).toBe(PublicKey.fromString(specificSupplyKey).toString());
    expect(res.kycKey).toBeUndefined();
    expect(res.adminKey).toBeUndefined();
    expect(res.tokenSymbol).toBeUndefined();
  });

  it('omits optional fields and keys that are not provided', async () => {
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.999',
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;

    expect(res.tokenId.toString()).toBe('0.0.999');
    expect(Object.keys(res).length).toBe(1); // Only tokenId
    expect(Object.prototype.hasOwnProperty.call(res, 'tokenName')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(res, 'adminKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(res, 'metadata')).toBe(false);
  });

  it('handles empty string for metadata gracefully (should not set metadata)', async () => {
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: '0.0.101',
      metadata: '',
    };

    const res = (await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    )) as any;
    expect(res.tokenId.toString()).toBe('0.0.101');
    expect(Object.prototype.hasOwnProperty.call(res, 'metadata')).toBe(false);
  });
});
