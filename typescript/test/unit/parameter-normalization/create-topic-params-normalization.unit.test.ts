import { describe, it, expect, vi, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(() => '0.0.1001'),
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
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: generatedKeyPair.publicKey.toStringDer(),
    });

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

  it('falls back to client.operatorPublicKey when mirror node has no key', async () => {
    const generatedKeyPair = PrivateKey.generateED25519();
    mirrorNode.getAccount.mockResolvedValueOnce({ accountPublicKey: undefined });
    client.operatorPublicKey.toStringDer.mockReturnValue(generatedKeyPair.publicKey.toStringDer());
    const opKeyDer = client.operatorPublicKey.toStringDer();

    const res = await HederaParameterNormaliser.normaliseCreateTopicParams(
      { isSubmitKey: true } as any,
      context,
      client,
      mirrorNode,
    );

    expect(res.submitKey).toBeDefined();
    expect(res.submitKey!.toString()).toBe(PublicKey.fromString(opKeyDer).toString());
  });

  it('throws an error when isSubmitKey is true and no public key can be determined', async () => {
    const clientNoOp: any = { operatorPublicKey: undefined };
    mirrorNode.getAccount.mockResolvedValueOnce({ accountPublicKey: undefined });

    await expect(
      HederaParameterNormaliser.normaliseCreateTopicParams(
        { isSubmitKey: true } as any,
        context,
        clientNoOp,
        mirrorNode,
      ),
    ).rejects.toThrow('Could not determine public key for submit key');
  });
});
