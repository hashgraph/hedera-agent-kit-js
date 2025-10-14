import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivateKey, PublicKey, TokenType } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { AccountResolver } from '@/shared/utils/account-resolver';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(),
    getDefaultPublicKey: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams', () => {
  const mirrorNode = {
    getAccount: vi.fn(),
  };
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
  });

  it('uses provided treasuryAccountId', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.2002');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: PublicKey.unusableKey().toStringDer(),
    });
    const params = {
      tokenName: 'MyNFT',
      tokenSymbol: 'MNFT',
      treasuryAccountId: '0.0.3003',
    } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.treasuryAccountId).toBe('0.0.3003');
    expect(result.autoRenewAccountId).toBe('0.0.2002');
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('falls back to AccountResolver for treasuryAccountId', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.4444');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: PublicKey.unusableKey().toStringDer(),
    });
    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS' } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.treasuryAccountId).toBe('0.0.4444');
    expect(result.autoRenewAccountId).toBe('0.0.4444');
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('throws if no treasury account ID can be resolved', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue(undefined);

    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS' } as any;

    await expect(
      HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
        params,
        context,
        client,
        mirrorNode as any,
      ),
    ).rejects.toThrow('Must include treasury account ID');
  });

  it('defaults maxSupply to 100 when not provided', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.1234');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: PublicKey.unusableKey().toStringDer(),
    });

    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS' } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.maxSupply).toBe(100);
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('uses provided maxSupply when specified', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.5678');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: PublicKey.unusableKey().toStringDer(),
    });

    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS', maxSupply: 500 } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.maxSupply).toBe(500);
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('sets token type to NonFungibleUnique', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.9876');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: PublicKey.unusableKey().toStringDer(),
    });

    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS' } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.tokenType).toBe(TokenType.NonFungibleUnique);
  });

  it('resolves supplyKey when isSupplyKey=true', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.8888');
    const keypair = PrivateKey.generateED25519();
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: keypair.publicKey.toStringDer(),
    });

    const params = {
      tokenName: 'NFT',
      tokenSymbol: 'NFTS',
      isSupplyKey: true,
    } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.supplyKey).toBeInstanceOf(PublicKey);
    expect(result.supplyKey!.toStringDer()).toBe(keypair.publicKey.toStringDer());
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('falls back to client.operatorPublicKey for supplyKey', async () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.9999');
    mirrorNode.getAccount.mockResolvedValueOnce({ accountPublicKey: undefined });

    const params = { tokenName: 'NFT', tokenSymbol: 'NFTS', isSupplyKey: true } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.supplyKey?.toStringDer()).toBe(OPERATOR_PUBLIC_KEY.toStringDer());
    expect(result.schedulingParams?.isScheduled).toBe(false);
  });

  it('handles scheduling parameters with adminKey and payerAccountID', async () => {
    const adminKeyPair = PrivateKey.generateED25519();
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.6666');
    (AccountResolver.getDefaultPublicKey as any).mockResolvedValue(
      adminKeyPair.publicKey.toStringDer(),
    );

    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: adminKeyPair.publicKey.toStringDer(),
    });

    const params = {
      tokenName: 'NFTWithAdmin',
      tokenSymbol: 'NWA',
      isSupplyKey: true,
      schedulingParams: {
        isScheduled: true,
        adminKey: true,
        payerAccountId: '0.0.7777',
        waitForExpiry: true,
      },
    } as any;

    const result = await HederaParameterNormaliser.normaliseCreateNonFungibleTokenParams(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.schedulingParams?.isScheduled).toBe(true);
    expect(result.schedulingParams?.payerAccountID?.toString()).toBe('0.0.7777');
    expect(result.schedulingParams?.waitForExpiry).toBe(true);
    expect(result.supplyKey?.toStringDer()).toBe(adminKeyPair.publicKey.toStringDer());
  });
});
