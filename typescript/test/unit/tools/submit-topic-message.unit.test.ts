import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  SUBMIT_TOPIC_MESSAGE_TOOL,
} from '@/plugins/core-consensus-plugin/tools/consensus/submit-topic-message';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { submitTopicMessage: vi.fn((_params: any) => ({ tx: 'submitTopicMessageTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      accountId: null,
      tokenId: null,
      transactionId: '0.0.1234@1700000000.000000001',
      topicId: '0.0.7777',
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getScheduledTransactionParamsDescription: vi.fn(() => 'mocked scheduled params desc'),
  },
}));

const makeClient = () => {
  return Client.forNetwork({});
};

describe('submit-topic-message tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    topicId: '0.0.7777',
    message: 'hello world',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(SUBMIT_TOPIC_MESSAGE_TOOL);
    expect(tool.name).toBe('Submit Topic Message');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain(
      'This tool will submit a message to a topic on the Hedera network.',
    );
    // includes usage instructions from PromptGenerator
    expect(tool.description).toContain('Usage: Provide the parameters as JSON.');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Message submitted successfully with transaction id/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.submitTopicMessage).toHaveBeenCalledTimes(1);
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.submitTopicMessage as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to submit message to topic');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to submit message to topic');
    expect(res.raw.error).toContain('boom');
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.submitTopicMessage as any).mockImplementation(() => {
      throw 'string error';
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to submit message to topic');
    expect(res.raw.error).toBe('Failed to submit message to topic');
  });
});
