import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HolAuditWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/hol-audit-writer';
import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import type { Client } from '@hiero-ledger/sdk';

const mockCreateFile = vi.fn();
const mockFileTopicExecute = vi.fn();
const mockFileMessageExecute = vi.fn();
const mockRegisterEntry = vi.fn();
const mockRegisterExecute = vi.fn();

vi.mock('@/hooks/hol-audit-trail-hook/hol/hcs2-registry-builder', () => ({
  Hcs2RegistryBuilder: {
    registerEntry: (...args: any[]) => mockRegisterEntry(...args),
  },
}));

vi.mock('@/hooks/hol-audit-trail-hook/hol/hcs1-file-builder', () => ({
  Hcs1FileBuilder: {
    createFile: (...args: any[]) => mockCreateFile(...args),
  },
}));

const makeEntry = (): AuditEntry => ({
  type: 'hedera-agent-kit:audit-entry',
  version: '1.0',
  source: 'hedera-agent-kit-js',
  timestamp: new Date().toISOString(),
  tool: 'transfer_hbar',
  params: { amount: 100 },
  result: { raw: { status: 'SUCCESS' }, message: 'ok' },
});

describe('HolAuditWriter', () => {
  let mockClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      operatorAccountId: { toString: () => '0.0.12345' },
      operatorPublicKey: 'mock-public-key',
    } as unknown as Client;

    mockCreateFile.mockReturnValue({
      topicTransaction: {
        execute: (...args: any[]) => mockFileTopicExecute(...args),
      },
      buildMessageTransactions: vi
        .fn()
        .mockReturnValue([{ execute: (...args: any[]) => mockFileMessageExecute(...args) }]),
    });
    mockFileTopicExecute.mockResolvedValue({
      getReceipt: vi.fn().mockResolvedValue({
        topicId: { toString: () => '0.0.1001' },
      }),
    });
    mockFileMessageExecute.mockResolvedValue(undefined);

    mockRegisterEntry.mockReturnValue({
      execute: (...args: any[]) => mockRegisterExecute(...args),
    });
    mockRegisterExecute.mockResolvedValue(undefined);
  });

  describe('setSessionId', () => {
    it('should store the session ID for use in write operations', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.666');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockRegisterEntry).toHaveBeenCalledWith(
        expect.objectContaining({ registryTopicId: '0.0.666' }),
      );
    });
  });

  describe('write', () => {
    it('should create an HCS-1 file with JSON-serialized entry content', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockCreateFile).toHaveBeenCalledTimes(1);
      const fileArgs = mockCreateFile.mock.calls[0][0];
      expect(fileArgs.content).toBe(JSON.stringify(entry));
    });

    it('should pass operator credentials to createFile', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      const fileArgs = mockCreateFile.mock.calls[0][0];
      expect(fileArgs.autoRenewAccountId).toBe('0.0.12345');
      expect(fileArgs.submitKey).toBe('mock-public-key');
    });

    it('should submit all chunk messages to the entry topic in order', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockFileTopicExecute).toHaveBeenCalledTimes(1);
      expect(mockFileMessageExecute).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple chunk messages', async () => {
      const mockMsg1Execute = vi.fn().mockResolvedValue(undefined);
      const mockMsg2Execute = vi.fn().mockResolvedValue(undefined);
      const mockMsg3Execute = vi.fn().mockResolvedValue(undefined);

      mockCreateFile.mockReturnValue({
        topicTransaction: {
          execute: (...args: any[]) => mockFileTopicExecute(...args),
        },
        buildMessageTransactions: vi
          .fn()
          .mockReturnValue([
            { execute: mockMsg1Execute },
            { execute: mockMsg2Execute },
            { execute: mockMsg3Execute },
          ]),
      });

      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockMsg1Execute).toHaveBeenCalledTimes(1);
      expect(mockMsg2Execute).toHaveBeenCalledTimes(1);
      expect(mockMsg3Execute).toHaveBeenCalledTimes(1);
    });

    it('should register the entry topic in the session registry', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockRegisterEntry).toHaveBeenCalledTimes(1);
      expect(mockRegisterEntry).toHaveBeenCalledWith({
        registryTopicId: '0.0.999',
        targetTopicId: '0.0.1001',
      });
    });

    it('should use the sessionId set via setSessionId as registryTopicId', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.666');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockRegisterEntry).toHaveBeenCalledWith(
        expect.objectContaining({ registryTopicId: '0.0.666' }),
      );
    });

    it('should use the HCS-1 topicId as targetTopicId in registration', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');
      const entry = makeEntry();
      await writer.write(entry);

      expect(mockRegisterEntry).toHaveBeenCalledWith(
        expect.objectContaining({ targetTopicId: '0.0.1001' }),
      );
    });

    it('should throw when HCS-1 topic creation receipt has no topicId', async () => {
      const writer = new HolAuditWriter(mockClient);
      writer.setSessionId('0.0.999');

      mockFileTopicExecute.mockResolvedValue({
        getReceipt: vi.fn().mockResolvedValue({ topicId: null }),
      });

      const entry = makeEntry();
      await expect(writer.write(entry)).rejects.toThrow(
        'Failed to create HCS-1 topic for audit entry',
      );
    });
  });
});
