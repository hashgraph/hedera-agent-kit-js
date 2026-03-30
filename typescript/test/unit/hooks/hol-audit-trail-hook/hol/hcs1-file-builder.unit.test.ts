import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hcs1FileBuilder } from '@/hooks/hol-audit-trail-hook/hol/hcs1-file-builder';
import { HCS1_CHUNK_SIZE, HCS1_CHUNK_ENVELOPE_SIZE } from '@/hooks/hol-audit-trail-hook/hol/constants';

const mockCreateTopic = vi.fn((params: any) => ({ ...params }));
const mockSubmitTopicMessage = vi.fn((params: any) => ({ ...params }));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    createTopic: (...args: any[]) => mockCreateTopic(...args),
    submitTopicMessage: (...args: any[]) => mockSubmitTopicMessage(...args),
  },
}));

describe('Hcs1FileBuilder', () => {
  const defaultParams = {
    autoRenewAccountId: '0.0.12345',
    submitKey: 'mock-public-key' as any,
    content: '{"key":"value"}',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFile', () => {
    it('should return an object with topicTransaction and buildMessageTransactions function', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);

      expect(result.topicTransaction).toBeDefined();
      expect(result.buildMessageTransactions).toBeInstanceOf(Function);
    });

    it('should set topic memo in hash:brotli:base64 format', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);

      expect(result.topicTransaction.topicMemo).toMatch(/^[a-f0-9]{64}:brotli:base64$/);
    });

    it('should call HederaBuilder.createTopic once with correct params', () => {
      Hcs1FileBuilder.createFile(defaultParams);

      expect(mockCreateTopic).toHaveBeenCalledOnce();
      expect(mockCreateTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          topicMemo: expect.stringMatching(/^[a-f0-9]{64}:brotli:base64$/),
          autoRenewAccountId: '0.0.12345',
          isSubmitKey: false,
          submitKey: 'mock-public-key',
        }),
      );
    });

    it('should default mimeType to application/json in data URI', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);
      const messages = result.buildMessageTransactions('0.0.100');

      const firstMessage = JSON.parse(messages[0].message);
      expect(firstMessage.c).toMatch(/^data:application\/json;base64,/);
    });

    it('should use custom mimeType when provided', () => {
      const result = Hcs1FileBuilder.createFile({
        ...defaultParams,
        mimeType: 'text/plain',
      });
      const messages = result.buildMessageTransactions('0.0.100');

      const firstMessage = JSON.parse(messages[0].message);
      expect(firstMessage.c).toMatch(/^data:text\/plain;base64,/);
    });

    it('should produce a data URI with base64-encoded brotli-compressed content', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);
      const messages = result.buildMessageTransactions('0.0.100');

      // Reassemble the data URI from all chunks
      const dataUri = messages
        .map((msg: any) => JSON.parse(msg.message).c)
        .join('');

      expect(dataUri).toMatch(/^data:application\/json;base64,.+/);
      // Extract the base64 portion and verify it's valid base64
      const base64Part = dataUri.split(',')[1];
      expect(() => Buffer.from(base64Part, 'base64')).not.toThrow();
    });

    it('should produce a single chunk message for small content', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);
      const messages = result.buildMessageTransactions('0.0.100');

      expect(messages.length).toBe(1);
    });

    it('should produce multiple chunk messages for content exceeding HCS1_CHUNK_SIZE', () => {
      const { randomBytes } = require('crypto');
      const largeContent = randomBytes(5000).toString('base64');
      const result = Hcs1FileBuilder.createFile({
        ...defaultParams,
        content: largeContent,
      });
      const messages = result.buildMessageTransactions('0.0.100');

      expect(messages.length).toBeGreaterThan(1);
    });

    it('should produce chunk messages with sequential ordinal (o) starting at 0', () => {
      const { randomBytes } = require('crypto');
      const largeContent = randomBytes(5000).toString('base64');
      const result = Hcs1FileBuilder.createFile({
        ...defaultParams,
        content: largeContent,
      });
      const messages = result.buildMessageTransactions('0.0.100');

      messages.forEach((msg: any, index: number) => {
        const parsed = JSON.parse(msg.message);
        expect(parsed.o).toBe(index);
      });
    });

    it('should ensure each chunk content (c) does not exceed HCS1_CHUNK_SIZE', () => {
      const { randomBytes } = require('crypto');
      const largeContent = randomBytes(5000).toString('base64');
      const result = Hcs1FileBuilder.createFile({
        ...defaultParams,
        content: largeContent,
      });
      const messages = result.buildMessageTransactions('0.0.100');

      messages.forEach((msg: any) => {
        const parsed = JSON.parse(msg.message);
        expect(parsed.c.length).toBeLessThanOrEqual(HCS1_CHUNK_SIZE);
      });
    });

    it('should ensure chunk envelope does not exceed HCS1_CHUNK_ENVELOPE_SIZE', () => {
      const { randomBytes } = require('crypto');
      const largeContent = randomBytes(5000).toString('base64');
      const result = Hcs1FileBuilder.createFile({
        ...defaultParams,
        content: largeContent,
      });
      const messages = result.buildMessageTransactions('0.0.100');

      expect(messages.length).toBeGreaterThan(1);
      messages.forEach((msg: any) => {
        const parsed = JSON.parse(msg.message);
        const envelopeSize = Buffer.byteLength(msg.message, 'utf-8') - Buffer.byteLength(parsed.c, 'utf-8');
        expect(envelopeSize).toBeLessThanOrEqual(HCS1_CHUNK_ENVELOPE_SIZE);
      });
    });
  });

  describe('buildMessageTransactions', () => {
    it('should create message transactions targeting the provided topicId', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);
      const messages = result.buildMessageTransactions('0.0.100');

      messages.forEach((msg: any) => {
        expect(msg.topicId).toBe('0.0.100');
      });
    });

    it('should call HederaBuilder.submitTopicMessage for each chunk with correct topicId', () => {
      const result = Hcs1FileBuilder.createFile(defaultParams);
      const messages = result.buildMessageTransactions('0.0.100');

      expect(mockSubmitTopicMessage).toHaveBeenCalledTimes(messages.length);
      for (const call of mockSubmitTopicMessage.mock.calls) {
        expect(call[0]).toEqual(
          expect.objectContaining({ topicId: '0.0.100' }),
        );
      }
    });
  });
});
