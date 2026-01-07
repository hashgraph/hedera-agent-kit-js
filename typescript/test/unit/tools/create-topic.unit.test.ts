import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  CREATE_TOPIC_TOOL,
} from '@/plugins/core-consensus-plugin/tools/consensus/create-topic';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseCreateTopicParams: vi.fn((params: any) => ({
      ...params,
      autoRenewAccountId: '0.0.1001',
    })),
  },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { createTopic: vi.fn((_params: any) => ({ tx: 'createTopicTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
      accountId: null,
      tokenId: null,
      transactionId: '0.0.1234@1700000000.000000001',
      topicId: { toString: () => '0.0.5005' },
    } as any;
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) } as any;
  }),
  RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({})),
  default: {},
}));

const makeClient = () => Client.forNetwork({});

describe('create-topic tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = { topicMemo: 'my topic', isSubmitKey: true } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_TOPIC_TOOL);
    expect(tool.name).toBe('Create Topic');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will create a new topic on the Hedera network.');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx and topic id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Topic created successfully with topic id 0.0.5005');
    expect(res.humanMessage).toContain('transaction id 0.0.1234@');

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.createTopic).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseCreateTopicParams).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('returns error response object when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.createTopic as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res: any = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to create topic');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to create topic');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.createTopic as any).mockImplementation(() => {
      throw 'string error';
    });

    const res: any = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to create topic');
    expect(res.raw.error).toContain('Failed to create topic');
  });
});
