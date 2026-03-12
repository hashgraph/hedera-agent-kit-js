import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hcs2RegistryBuilder } from '@/shared/hooks/hol-audit-trail-hook/hol/hcs2-registry-builder';
import { HCS2_REGISTRY_TYPE } from '@/shared/hooks/hol-audit-trail-hook/hol/constants';

const mockCreateTopic = vi.fn((params: any) => ({ ...params }));
const mockSubmitTopicMessage = vi.fn((params: any) => ({ ...params }));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    createTopic: (...args: any[]) => mockCreateTopic(...args),
    submitTopicMessage: (...args: any[]) => mockSubmitTopicMessage(...args),
  },
}));

describe('Hcs2RegistryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRegistry', () => {
    it('should create a topic with hcs-2 protocol memo', () => {
      const result = Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
      });

      expect(result.topicMemo).toContain('hcs-2');
    });

    it('should default registryType to INDEXED (0)', () => {
      const result = Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
      });

      expect(result.topicMemo).toBe('hcs-2:0:0');
    });

    it('should default ttl to 0', () => {
      const result = Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
      });

      expect(result.topicMemo).toMatch(/:0$/);
    });

    it('should use NON_INDEXED registry type when specified', () => {
      const result = Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
        registryType: HCS2_REGISTRY_TYPE.NON_INDEXED,
      });

      expect(result.topicMemo).toBe('hcs-2:1:0');
    });

    it('should use custom TTL when specified', () => {
      const result = Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
        ttl: 3600,
      });

      expect(result.topicMemo).toBe('hcs-2:0:3600');
    });

    it('should call HederaBuilder.createTopic once with correct params', () => {
      Hcs2RegistryBuilder.createRegistry({
        autoRenewAccountId: '0.0.12345',
        submitKey: 'mock-key' as any,
        ttl: 3600,
      });

      expect(mockCreateTopic).toHaveBeenCalledOnce();
      expect(mockCreateTopic).toHaveBeenCalledWith({
        topicMemo: 'hcs-2:0:3600',
        autoRenewAccountId: '0.0.12345',
        isSubmitKey: false,
        submitKey: 'mock-key',
      });
    });
  });

  describe('registerEntry', () => {
    it('should create an HCS-2 register message with protocol, operation, and target topic ID', () => {
      const result = Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
      });

      const message = JSON.parse(result.message);
      expect(message.p).toBe('hcs-2');
      expect(message.op).toBe('register');
      expect(message.t_id).toBe('0.0.200');
    });

    it('should submit the message to the correct registry topicId', () => {
      const result = Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
      });

      expect(result.topicId).toBe('0.0.100');
    });

    it('should include metadata in message when provided', () => {
      const result = Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
        metadata: 'some-metadata',
      });

      const message = JSON.parse(result.message);
      expect(message.metadata).toBe('some-metadata');
    });

    it('should include memo (m) in message when provided', () => {
      const result = Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
        memo: 'test memo',
      });

      const message = JSON.parse(result.message);
      expect(message.m).toBe('test memo');
    });

    it('should omit metadata and memo from JSON when not provided', () => {
      const result = Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
      });

      const message = JSON.parse(result.message);
      expect(message.metadata).toBeUndefined();
      expect(message.m).toBeUndefined();
    });

    it('should call HederaBuilder.submitTopicMessage once with correct params', () => {
      Hcs2RegistryBuilder.registerEntry({
        registryTopicId: '0.0.100',
        targetTopicId: '0.0.200',
      });

      expect(mockSubmitTopicMessage).toHaveBeenCalledOnce();
      expect(mockSubmitTopicMessage).toHaveBeenCalledWith({
        topicId: '0.0.100',
        message: JSON.stringify({
          p: 'hcs-2',
          op: 'register',
          t_id: '0.0.200',
          metadata: undefined,
          m: undefined,
        }),
      });
    });
  });
});
