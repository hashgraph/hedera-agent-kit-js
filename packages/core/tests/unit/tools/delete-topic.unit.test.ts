import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, {
  DELETE_TOPIC_TOOL,
} from '@/plugins/core-consensus-plugin/tools/consensus/delete-topic';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseDeleteTopic: vi.fn((params: any) => ({ ...params })),
  },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { deleteTopic: vi.fn((_params: any) => ({ tx: 'deleteTopicTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
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

describe('delete-topic tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = { topicId: '0.0.5005' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(DELETE_TOPIC_TOOL);
    expect(tool.name).toBe('Delete Topic');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will delete a given Hedera network topic.');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Topic with id 0.0.5005 deleted successfully');
    expect(res.humanMessage).toContain('Transaction id 0.0.1234@');

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.deleteTopic).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseDeleteTopic).toHaveBeenCalledWith(
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
    (HederaBuilder.deleteTopic as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res: any = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to delete the topic');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to delete the topic');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.deleteTopic as any).mockImplementation(() => {
      throw 'string error';
    });

    const res: any = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to delete the topic');
    expect(res.raw.error).toContain('Failed to delete the topic');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });
});
