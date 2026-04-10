import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopicId, AccountId, PublicKey, PrivateKey } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { z } from 'zod';
import { AccountResolver } from '@/shared/utils/account-resolver';
import { updateTopicParameters } from '@/shared/parameter-schemas/consensus.zod';

// Mock AccountResolver to always return a fixed user key
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultPublicKey: vi.fn(async () =>
      PublicKey.fromString(
        '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2',
      ),
    ),
  },
}));

describe('HederaParameterNormaliser.normaliseUpdateTopic', () => {
  const context: any = { accountId: '0.0.5005' };
  const client: any = { operatorAccountId: AccountId.fromString('0.0.5005') };
  const mockUserPublicKey = PublicKey.fromString(
    '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2',
  );

  beforeEach(() => {
    vi.clearAllMocks();
    (AccountResolver.getDefaultPublicKey as any).mockResolvedValue(mockUserPublicKey);
    vi.spyOn(HederaParameterNormaliser as any, 'resolveKey');
  });

  it('normalises topicId and includes only topicId if no other fields', async () => {
    const params: z.infer<ReturnType<typeof updateTopicParameters>> = {
      topicId: '0.0.123',
    };

    const res = await HederaParameterNormaliser.normaliseUpdateTopic(params, context, client);

    expect(res.topicId).toBeInstanceOf(TopicId);
    expect(res.topicId.toString()).toBe('0.0.123');
    expect(Object.keys(res)).toEqual(['topicId']); // only topicId
  });

  it('normalises topicId and includes optional props', async () => {
    const params: z.infer<ReturnType<typeof updateTopicParameters>> = {
      topicId: '0.0.321',
      topicMemo: 'Test memo',
      autoRenewAccountId: '0.0.789',
      autoRenewPeriod: 3600,
      expirationTime: '2024-01-01T00:00:00Z',
    };

    const res = await HederaParameterNormaliser.normaliseUpdateTopic(params, context, client);

    expect(res.topicId.toString()).toBe('0.0.321');
    expect(res.topicMemo).toBe('Test memo');
    expect(res.autoRenewAccountId).toBe('0.0.789');
    expect(res.autoRenewPeriod).toBe(3600);
    expect(res.expirationTime).toBeInstanceOf(Date);
    expect(res.expirationTime!.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('normalises keys: adminKey(true), submitKey(string)', async () => {
    const newKey = PrivateKey.generateED25519().publicKey.toStringDer();
    const params: z.infer<ReturnType<typeof updateTopicParameters>> = {
      topicId: '0.0.555',
      adminKey: true,
      submitKey: newKey,
    };

    const res = await HederaParameterNormaliser.normaliseUpdateTopic(params, context, client);

    expect(HederaParameterNormaliser['resolveKey']).toHaveBeenCalledWith(true, mockUserPublicKey);
    expect(HederaParameterNormaliser['resolveKey']).toHaveBeenCalledWith(newKey, mockUserPublicKey);

    expect(res.adminKey).toBeInstanceOf(PublicKey);
    expect(res.adminKey!.toString()).toBe(mockUserPublicKey.toString());
    expect(res.submitKey).toBeInstanceOf(PublicKey);
    expect(res.submitKey!.toString()).toBe(PublicKey.fromString(newKey).toString());
  });

  it('omits keys and optional props if not provided', async () => {
    const params: z.infer<ReturnType<typeof updateTopicParameters>> = {
      topicId: '0.0.999',
    };

    const res = await HederaParameterNormaliser.normaliseUpdateTopic(params, context, client);

    expect(res.topicId.toString()).toBe('0.0.999');
    expect(res.adminKey).toBeUndefined();
    expect(res.submitKey).toBeUndefined();
    expect(res.topicMemo).toBeUndefined();
    expect(res.autoRenewPeriod).toBeUndefined();
    expect(res.expirationTime).toBeUndefined();
  });

  it('normalises expirationTime if provided as Date', async () => {
    const expiration = new Date('2025-12-25T12:00:00Z');
    const params: z.infer<ReturnType<typeof updateTopicParameters>> = {
      topicId: '0.0.1010',
      expirationTime: expiration,
    };

    const res = await HederaParameterNormaliser.normaliseUpdateTopic(params, context, client);

    expect(res.expirationTime).toBeInstanceOf(Date);
    expect(res.expirationTime!.toISOString()).toBe(expiration.toISOString());
  });
});
