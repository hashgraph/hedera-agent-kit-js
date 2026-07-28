import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HcsAuditTrailHook } from '@/hooks/hcs-audit-trail-hook';
import { AgentMode } from '@/shared/configuration';
import type { PostSecondaryActionParams, PreToolExecutionParams } from '@/shared/hook';
import type { RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import * as sdk from '@hiero-ledger/sdk';
import { Client } from '@hiero-ledger/sdk';

// Mock Hashgraph SDK minimally
vi.mock('@hiero-ledger/sdk', () => {
  const TopicMessageSubmitTransactionMock = vi.fn().mockImplementation(function () {
    return {
      setTopicId: vi.fn().mockReturnThis(),
      setMessage: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({
        getReceipt: vi.fn().mockResolvedValue({
          status: {
            toString: () => 'SUCCESS',
          },
        }),
      }),
    };
  });

  const LedgerIdMock = {
    TESTNET: { toString: () => 'testnet' },
    MAINNET: { toString: () => 'mainnet' },
    PREVIEWNET: { toString: () => 'previewnet' },
    LOCAL_NODE: { toString: () => 'local-node' },
  };

  return {
    TopicMessageSubmitTransaction: TopicMessageSubmitTransactionMock,
    Client: vi.fn(),
    LedgerId: LedgerIdMock,
  };
});

describe('HcsAuditTrailHook Unit Tests', () => {
  let mockClient: Client;
  let hook: HcsAuditTrailHook;
  const topicId = '0.0.123';
  const relevantTools = ['test_tool'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {} as Client;
    hook = new HcsAuditTrailHook(relevantTools, topicId, mockClient);
  });

  it('should not log or throw if method is not relevant', async () => {
    const operatorClient = {} as Client;
    const context = { mode: AgentMode.RETURN_BYTES };
    const preParams = { context, client: operatorClient } as PreToolExecutionParams;
    const postParams = { context, normalisedParams: {} } as PostSecondaryActionParams;

    const postMessageSpy = vi.spyOn(hook, 'postMessageToHcsTopic');

    // Neither pre- nor post-hook should throw or log for a non-relevant tool
    await expect(hook.preToolExecutionHook(preParams, 'other_tool')).resolves.toBeUndefined();
    await hook.postToolExecutionHook(postParams, 'other_tool');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it.each([AgentMode.RETURN_BYTES, AgentMode.CUSTOM_RETURN_BYTES])(
    'should throw if mode is %s in preToolExecutionHook',
    async mode => {
      const operatorClient = {} as Client;
      const context = { mode };
      const params = { context, client: operatorClient } as PreToolExecutionParams;

      await expect(hook.preToolExecutionHook(params, 'test_tool')).rejects.toThrow(
        'Unsupported hook: HcsAuditTrailHook does not support AgentMode.RETURN_BYTES or AgentMode.CUSTOM_RETURN_BYTES. Stopping the agent execution before tool test_tool is executed.',
      );
    },
  );

  it('should not throw if mode is CUSTOM_EXECUTE_TX in preToolExecutionHook', async () => {
    const operatorClient = {} as Client;
    const context = { mode: AgentMode.CUSTOM_EXECUTE_TX };
    const params = { context, client: operatorClient } as PreToolExecutionParams;

    await expect(hook.preToolExecutionHook(params, 'test_tool')).resolves.not.toThrow();
  });

  it('should log message in postToolExecutionHook when mode is CUSTOM_EXECUTE_TX', async () => {
    const operatorClient = { isOperatorClient: true } as unknown as Client;
    const context = { mode: AgentMode.CUSTOM_EXECUTE_TX };
    const params = {
      context,
      normalisedParams: { amount: 50 },
      client: operatorClient,
      toolResult: {
        raw: {
          transactionId: '0.0.1@456',
          status: 'SUCCESS',
          accountId: null,
          tokenId: null,
          topicId: null,
          scheduleId: null,
        } as RawTransactionResponse,
        humanMessage: 'Custom strategy executed successfully.',
      },
    } as PostSecondaryActionParams;

    await hook.postToolExecutionHook(params, 'test_tool');

    const TopicMessageSubmitTransactionMock = sdk.TopicMessageSubmitTransaction as any;
    expect(TopicMessageSubmitTransactionMock).toHaveBeenCalled();
    const mockInstance = TopicMessageSubmitTransactionMock.mock.results[0].value;
    expect(mockInstance.setMessage).toHaveBeenCalledWith(
      expect.stringContaining('Agent executed tool test_tool'),
    );
    expect(mockInstance.setMessage).toHaveBeenCalledWith(
      expect.stringContaining('0.0.1@456'),
    );
  });

  it('should log using the operator client if loggingClient is missing', async () => {
    const operatorClient = { isOperatorClient: true } as unknown as Client;
    const context = { mode: AgentMode.AUTONOMOUS };
    const params = {
      context,
      normalisedParams: { amount: 100 },
      toolResult: { raw: {} as RawTransactionResponse },
      client: operatorClient,
    } as PostSecondaryActionParams;

    const hookWithoutClient = new HcsAuditTrailHook(relevantTools, topicId);
    const postMessageSpy = vi
      .spyOn(hookWithoutClient, 'postMessageToHcsTopic')
      .mockImplementation(async () => {});

    await hookWithoutClient.postToolExecutionHook(params, 'test_tool');

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent executed tool test_tool'),
      operatorClient,
    );
  });

  it('should log message if all conditions are met using provided logging client', async () => {
    const operatorClient = { isOperatorClient: true } as unknown as Client;
    const context = { mode: AgentMode.AUTONOMOUS };
    const params = {
      context,
      normalisedParams: { amount: 100 },
      client: operatorClient,
      toolResult: {
        raw: {
          transactionId: '0.0.1@123',
          status: 'SUCCESS',
          accountId: '0.0.456',
        } as unknown as RawTransactionResponse,
      },
    } as PostSecondaryActionParams;

    await hook.postToolExecutionHook(params, 'test_tool');

    const TopicMessageSubmitTransactionMock = sdk.TopicMessageSubmitTransaction as any;
    expect(TopicMessageSubmitTransactionMock).toHaveBeenCalled();

    // Check results from a mock factory
    const mockInstance = TopicMessageSubmitTransactionMock.mock.results[0].value;
    expect(mockInstance.setTopicId).toHaveBeenCalledWith(topicId);
    expect(mockInstance.setMessage).toHaveBeenCalledWith(
      expect.stringContaining('Agent executed tool test_tool'),
    );
    expect(mockInstance.setMessage).toHaveBeenCalledWith(expect.stringContaining('"amount": 100'));
    // execute should be called with hook's provided logging client, not the operatorClient
    expect(mockInstance.execute).toHaveBeenCalledWith(mockClient);
  });
});
