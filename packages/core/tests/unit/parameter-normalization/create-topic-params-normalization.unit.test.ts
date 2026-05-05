import { describe, it, expect, vi, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PrivateKey, PublicKey } from '@hiero-ledger/sdk';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(() => '0.0.1001'),
    getDefaultPublicKey: vi.fn(),
  },
}));
import { AccountResolver } from '@/shared/utils/account-resolver';

describe('HederaParameterNormaliser.normaliseCreateTopicParams', () => {
  const client: any = {
    operatorPublicKey: {
      toStringDer: vi.fn(),
    },
  };
  const context: any = { accountId: '0.0.1001' };

  const mirrorNode: any = {
    getAccount: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies defaults when values are not provided (no submit key)', async () => {
    const params: any = {};

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      params,
      context,
      client,
      mirrorNode,
    );

    expect(res.topicMemo).toBeUndefined();
    expect(res.autoRenewAccountId).toBe(AccountResolver.getDefaultAccount(context, client));
    expect(res.submitKey).toBeUndefined();
  });

  it('sets submitKey from mirror node when isSubmitKey is true and mirror has key', async () => {
    const generatedKeyPair = PrivateKey.generateED25519();
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValue(generatedKeyPair.publicKey);

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      { isSubmitKey: true, topicMemo: 'hello' } as any,
      context,
      client,
      mirrorNode,
    );

    expect(res.isSubmitKey).toBe(true);
    expect(res.submitKey?.toString()).toBe(generatedKeyPair.publicKey.toStringDer());
    expect(res.topicMemo).toBe('hello');
  });

  it('sets submitKey and adminKey from boolean true', async () => {
    const generatedKeyPair = PrivateKey.generateED25519();
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValue(generatedKeyPair.publicKey);

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      { submitKey: true, adminKey: true } as any,
      context,
      client,
      mirrorNode,
    );

    expect(res.submitKey?.toString()).toBe(generatedKeyPair.publicKey.toStringDer());
    expect(res.adminKey?.toString()).toBe(generatedKeyPair.publicKey.toStringDer());
  });

  it('sets submitKey and adminKey from public key strings', async () => {
    const key1 = PrivateKey.generateED25519().publicKey;
    const key2 = PrivateKey.generateED25519().publicKey;

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      { submitKey: key1.toStringDer(), adminKey: key2.toStringDer() } as any,
      context,
      client,
      mirrorNode,
    );

    expect(res.submitKey?.toString()).toBe(key1.toStringDer());
    expect(res.adminKey?.toString()).toBe(key2.toStringDer());
  });

  it('falls back to client.operatorPublicKey when normalising', async () => {
    const generatedKeyPair = PrivateKey.generateED25519();
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValue(generatedKeyPair.publicKey);

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      { submitKey: true } as any,
      context,
      client,
      mirrorNode,
    );

    expect(res.submitKey).toBeDefined();
    expect(res.submitKey!.toString()).toBe(generatedKeyPair.publicKey.toStringDer());
  });

  it('throws an error when public key cannot be determined for boolean true', async () => {
    const clientNoOp: any = {
      operatorPublicKey: undefined,
    };
    // Mock resolveKey to throw if it were called with true and no userKey,
    // but normaliseCreateTopicParams fetches userPublicKey first.

    vi.spyOn(AccountResolver, 'getDefaultPublicKey').mockResolvedValueOnce(undefined as any);

    await expect(
      HederaParameterNormaliser.normaliseCreateTopicParams(
        { submitKey: true } as any,
        context,
        clientNoOp,
        mirrorNode,
      ),
    ).rejects.toThrow();
  });
});
