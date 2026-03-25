import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HolAuditTrailHook } from '@/hooks/hol-audit-trail-hook';
import { AgentMode } from '@/shared/configuration';
import { PostSecondaryActionParams, PreToolExecutionParams } from '@/shared/abstract-hook';
import type { Client } from '@hashgraph/sdk';

const mockEntryExecute = vi.fn();
const mockRegisterEntry = vi.fn();
const mockCreateFile = vi.fn();
const mockEntryFileTopicExecute = vi.fn();
const mockEntryFileMessageExecute = vi.fn();

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

const defaultConfig = {
  relevantTools: ['test_tool'],
  sessionId: '0.0.666',
};

describe('HolAuditTrailHook', () => {
  let mockClient: Client;
  let hook: HolAuditTrailHook;

  const makePostParams = (overrides?: Partial<PostSecondaryActionParams>): PostSecondaryActionParams =>
    ({
      normalisedParams: { amount: 100 },
      toolResult: {
        raw: {
          status: 'SUCCESS',
          transactionId: '0.0.1@123',
          accountId: '0.0.456',
        },
        humanMessage: 'Transfer of 100 HBAR succeeded',
      },
      client: mockClient,
      ...overrides,
    }) as PostSecondaryActionParams;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      operatorAccountId: { toString: () => '0.0.12345' },
      operatorPublicKey: 'mock-public-key',
    } as unknown as Client;

    mockCreateFile.mockReturnValue({
      topicTransaction: {
        execute: (...args: any[]) => mockEntryFileTopicExecute(...args),
      },
      buildMessageTransactions: vi.fn().mockReturnValue([
        { execute: (...args: any[]) => mockEntryFileMessageExecute(...args) },
      ]),
    });
    mockEntryFileTopicExecute.mockResolvedValue({
      getReceipt: vi.fn().mockResolvedValue({
        topicId: { toString: () => '0.0.1001' },
      }),
    });
    mockEntryFileMessageExecute.mockResolvedValue(undefined);

    mockRegisterEntry.mockReturnValue({
      execute: (...args: any[]) => mockEntryExecute(...args),
    });
    mockEntryExecute.mockResolvedValue(undefined);

    hook = new HolAuditTrailHook({ ...defaultConfig });
  });

  it('should set name, description, and relevantTools from config', () => {
    expect(hook.name).toBe('HOL Audit Trail Hook');
    expect(hook.description).toContain('HOL-standards-compliant');
    expect(hook.relevantTools).toEqual(['test_tool']);
  });

  it('should throw when sessionId is not provided', () => {
    expect(() => new HolAuditTrailHook({ relevantTools: ['test_tool'] } as any)).toThrow();
  });

  it('should throw when sessionId is empty string', () => {
    expect(() => new HolAuditTrailHook({ relevantTools: ['test_tool'], sessionId: '' })).toThrow(
      /sessionId must be a valid Hedera topic ID/,
    );
  });

  it('should throw when sessionId is not a valid Hedera topic ID format', () => {
    expect(() => new HolAuditTrailHook({ relevantTools: ['test_tool'], sessionId: 'not-a-topic' })).toThrow(
      /sessionId must be a valid Hedera topic ID/,
    );
  });

  describe('getSessionId', () => {
    it('should return configured sessionId before any tool execution', () => {
      expect(hook.getSessionId()).toBe('0.0.666');
    });

    it('should return session ID from AuditSession after first tool execution', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(hook.getSessionId()).toBe('0.0.666');
    });
  });

  describe('preToolExecutionHook', () => {
    it('should return undefined for irrelevant tools', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const params = {} as PreToolExecutionParams;

      const result = await hook.preToolExecutionHook(context, params, 'other_tool');

      expect(result).toBeUndefined();
    });

    it('should not throw when mode is AUTONOMOUS for a relevant tool', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const params = {} as PreToolExecutionParams;

      await expect(
        hook.preToolExecutionHook(context, params, 'test_tool'),
      ).resolves.not.toThrow();
    });

    it('should throw when mode is RETURN_BYTES for a relevant tool', async () => {
      const context = { mode: AgentMode.RETURN_BYTES };
      const params = {} as PreToolExecutionParams;

      await expect(
        hook.preToolExecutionHook(context, params, 'test_tool'),
      ).rejects.toThrow(
        'Unsupported hook: HolAuditTrailHook is available only in Agent Mode AUTONOMOUS. Stopping the agent execution before tool test_tool is executed.',
      );
    });
  });

  describe('postToolExecutionHook', () => {
    it('should return undefined for irrelevant tools without creating session', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      const result = await hook.postToolExecutionHook(context, postParams, 'other_tool');

      expect(result).toBeUndefined();
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockRegisterEntry).not.toHaveBeenCalled();
    });

    it('should lazily create HolAuditWriter and AuditSession on first relevant call', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(mockCreateFile).toHaveBeenCalledTimes(1);
      expect(hook.getSessionId()).toBe('0.0.666');
    });

    it('should reuse the same session on subsequent calls', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');
      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      // File created twice (once per call)
      expect(mockCreateFile).toHaveBeenCalledTimes(2);
    });

    it('should build audit entry with tool name, normalised params, and result', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(mockCreateFile).toHaveBeenCalledTimes(1);
      const fileArgs = mockCreateFile.mock.calls[0][0];
      const entryContent = JSON.parse(fileArgs.content);
      expect(entryContent.tool).toBe('test_tool');
      expect(entryContent.params).toEqual({ amount: 100 });
      expect(entryContent.result.raw).toEqual({
        status: 'SUCCESS',
        transactionId: '0.0.1@123',
        accountId: '0.0.456',
      });
      expect(entryContent.result.message).toBe('Transfer of 100 HBAR succeeded');
    });

    it('should write the entry to the session', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(mockEntryFileTopicExecute).toHaveBeenCalledTimes(1);
      expect(mockEntryFileMessageExecute).toHaveBeenCalledTimes(1);
      expect(mockEntryExecute).toHaveBeenCalledTimes(1);
    });

    it('should create an HCS-1 topic with serialized entry content', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(mockCreateFile).toHaveBeenCalledTimes(1);
      const fileArgs = mockCreateFile.mock.calls[0][0];
      expect(fileArgs.content).toContain('"hedera-agent-kit:audit-entry"');
      expect(fileArgs.content).toContain('"test_tool"');
    });

    it('should register the HCS-1 entry topic in the session registry', async () => {
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await hook.postToolExecutionHook(context, postParams, 'test_tool');

      expect(mockRegisterEntry).toHaveBeenCalledTimes(1);
      expect(mockRegisterEntry).toHaveBeenCalledWith({
        registryTopicId: '0.0.666',
        targetTopicId: '0.0.1001',
      });
    });

    it('should catch and log errors without throwing when write fails', async () => {
      mockEntryExecute.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const context = { mode: AgentMode.AUTONOMOUS };
      const postParams = makePostParams();

      await expect(
        hook.postToolExecutionHook(context, postParams, 'test_tool'),
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HolAuditTrailHook: Failed to log audit entry'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

  });
});
