import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HcsAuditTrailHook } from '@/shared/hooks/hcs-audit-trail-hook';
import { AgentMode } from '@/shared/configuration';
import type { PostSecondaryActionParams } from '@/shared/abstract-hook';
import type { RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import * as sdk from '@hashgraph/sdk';

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
  let mockClient: sdk.Client;
  let hook: HcsAuditTrailHook;
  const topicId = '0.0.123';
  const relevantTools = ['test_tool'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {} as sdk.Client;
    hook = new HcsAuditTrailHook(relevantTools, topicId, mockClient);
  });

  it('should not log if method is not relevant', async () => {
    const context = { mode: AgentMode.AUTONOMOUS };
    const params = { normalisedParams: {} } as PostSecondaryActionParams;
    const postMessageSpy = vi.spyOn(hook, 'postMessageToHcsTopic');

    await hook.postToolExecutionHook(context, params, 'other_tool');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should not log if mode is RETURN_BYTES', async () => {
    const context = { mode: AgentMode.RETURN_BYTES };
    const params = { normalisedParams: {} } as PostSecondaryActionParams;
    const postMessageSpy = vi.spyOn(hook, 'postMessageToHcsTopic');

    await hook.postToolExecutionHook(context, params, 'test_tool');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should not log if loggingClient is missing', async () => {
    const context = { mode: AgentMode.AUTONOMOUS };
    const params = { normalisedParams: {} } as PostSecondaryActionParams;
    const hookWithoutClient = new HcsAuditTrailHook(relevantTools, topicId, null as any);
    const postMessageSpy = vi.spyOn(hookWithoutClient, 'postMessageToHcsTopic');

    await hookWithoutClient.postToolExecutionHook(context, params, 'test_tool');

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should log message if all conditions are met', async () => {
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

    await hook.postToolExecutionHook(context, params, 'test_tool');

    const TopicMessageSubmitTransactionMock = sdk.TopicMessageSubmitTransaction as any;
    expect(TopicMessageSubmitTransactionMock).toHaveBeenCalled();

    // Check results from mock factory
    const mockInstance = TopicMessageSubmitTransactionMock.mock.results[0].value;
    expect(mockInstance.setTopicId).toHaveBeenCalledWith(topicId);
    expect(mockInstance.setMessage).toHaveBeenCalledWith(
      expect.stringContaining('Agent executed tool test_tool'),
    );
    expect(mockInstance.setMessage).toHaveBeenCalledWith(expect.stringContaining('"amount":100'));
    expect(mockInstance.execute).toHaveBeenCalledWith(mockClient);
  });
});
