import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_TOPIC_INFO_QUERY_TOOL,
} from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-info-query';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

// ---- MOCKS ----
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage instructions'),
    getContextSnippet: vi.fn(() => 'context snippet'),
  },
}));

// ---- SHALLOW MOCKS ----
const mockedMirrorNode = vi.mocked(getMirrornodeService, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forNetwork({});

describe('Get Topic Info Tool (unit)', () => {
  const context = { mirrornodeService: 'mockService' } as any;
  const mockTopicInfo = {
    topic_id: '0.0.1234',
    memo: 'Hello Topic',
    deleted: false,
    admin_key: { _type: 'ED25519', key: 'abcd' },
    submit_key: null,
    auto_renew_account: '0.0.1001',
    auto_renew_period: 7890000,
    created_timestamp: '1690000000.000000001',
    sequence_number: 3,
  };

  const mirrornodeMock = {
    getTopicInfo: vi.fn(async _topicId => mockTopicInfo),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedMirrorNode.mockReturnValue(mirrornodeMock as any);
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_TOPIC_INFO_QUERY_TOOL);
    expect(tool.name).toBe('Get Topic Info');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('context snippet');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns topic info', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = { topicId: '0.0.1234' } as any;

    const res: any = await tool.execute(client, context, params);

    expect(res.raw.topicId).toBe('0.0.1234');
    expect(res.raw.topicInfo.memo).toBe('Hello Topic');
    expect(res.humanMessage).toContain('Here are the details for topic **0.0.1234**');
  });

  it('returns error message when mirrornode fails', async () => {
    mirrornodeMock.getTopicInfo.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const params = { topicId: '0.0.1234' } as any;

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Network failure');
    expect(res.raw.error).toContain('Network failure');
  });

  it('returns generic error when non-error thrown', async () => {
    mirrornodeMock.getTopicInfo.mockImplementationOnce(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const params = { topicId: '0.0.1234' } as any;

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toBe('Failed to get topic info');
    expect(res.raw.error).toBe('Failed to get topic info');
  });
});


