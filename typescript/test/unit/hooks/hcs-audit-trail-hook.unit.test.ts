import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HcsAuditTrailHook } from '@/shared/hooks/hcs-audit-trail-hook';
import { AgentMode } from '@/shared/configuration';
import type { PostSecondaryActionParams, PreToolExecutionParams } from '@/shared/abstract-hook';
import type { RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import * as sdk from '@hashgraph/sdk';
import { Client } from '@hashgraph/sdk';

// Mock UsdToHbarService to prevent it from making network requests during global setup
vi.mock('../../utils/usd-to-hbar-service', () => {
  return {
    UsdToHbarService: {
      getIsInitialized: () => true,
      initialize: vi.fn().mockResolvedValue(undefined),
      getExchangeRate: () => 0.1,
      usdToHbar: (usd: number) => usd / 0.1,
    },
  };
});

// Mock Hashgraph SDK minimally
vi.mock('@hashgraph/sdk', () => {
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
    const preParams = {} as PreToolExecutionParams;
    const postParams = { normalisedParams: {} } as PostSecondaryActionParams;

    const postMessageSpy = vi.spyOn(hook, 'postMessageToHcsTopic');

    // Neither pre- nor post-hook should throw or log for a non-relevant tool
    await expect(
      hook.preToolExecutionHook(context, preParams, 'other_tool', operatorClient),
    ).resolves.toBeUndefined();
    await hook.postToolExecutionHook(context, postParams, 'other_tool', operatorClient);

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should throw if mode is RETURN_BYTES in preToolExecutionHook', async () => {
    const operatorClient = {} as Client;
    const context = { mode: AgentMode.RETURN_BYTES };
    const params = {} as PreToolExecutionParams;

    await expect(
      hook.preToolExecutionHook(context, params, 'test_tool', operatorClient),
    ).rejects.toThrow(
      'Unsupported hook: HcsAuditTrailHook is available only in Agent Mode AUTONOMOUS. Stopping the agent execution before tool test_tool is executed.',
    );
  });

  it('should log using the operator client if loggingClient is missing', async () => {
    const operatorClient = { isOperatorClient: true } as unknown as Client;
    const context = { mode: AgentMode.AUTONOMOUS };
    const params = {
      normalisedParams: { amount: 100 },
      toolResult: { raw: {} as RawTransactionResponse },
    } as PostSecondaryActionParams;

    const hookWithoutClient = new HcsAuditTrailHook(relevantTools, topicId);
    const postMessageSpy = vi
      .spyOn(hookWithoutClient, 'postMessageToHcsTopic')
      .mockImplementation(async () => {});

    await hookWithoutClient.postToolExecutionHook(context, params, 'test_tool', operatorClient);

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
      normalisedParams: { amount: 100 },
      toolResult: {
        raw: {
          transactionId: '0.0.1@123',
          status: 'SUCCESS',
          accountId: '0.0.456',
        } as unknown as RawTransactionResponse,
      },
    } as PostSecondaryActionParams;

    await hook.postToolExecutionHook(context, params, 'test_tool', operatorClient);

    const TopicMessageSubmitTransactionMock = sdk.TopicMessageSubmitTransaction as any;
    expect(TopicMessageSubmitTransactionMock).toHaveBeenCalled();

    // Check results from a mock factory
    const mockInstance = TopicMessageSubmitTransactionMock.mock.results[0].value;
    expect(mockInstance.setTopicId).toHaveBeenCalledWith(topicId);
    expect(mockInstance.setMessage).toHaveBeenCalledWith(
      expect.stringContaining('Agent executed tool test_tool'),
    );
    expect(mockInstance.setMessage).toHaveBeenCalledWith(expect.stringContaining('"amount":100'));
    // execute should be called with hook's provided logging client, not the operatorClient
    expect(mockInstance.execute).toHaveBeenCalledWith(mockClient);
  });
});
