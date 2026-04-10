import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hcs2RegistryBuilder } from '@/hooks/hol-audit-trail-hook/hol/hcs2-registry-builder';

const mockSubmitTopicMessage = vi.fn((params: any) => ({ ...params }));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    submitTopicMessage: (...args: any[]) => mockSubmitTopicMessage(...args),
  },
}));

describe('Hcs2RegistryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
