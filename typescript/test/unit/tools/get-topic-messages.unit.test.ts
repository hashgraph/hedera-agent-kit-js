import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-messages-query';
import { topicMessagesQueryParameters } from '@/shared/parameter-schemas/consensus.zod';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { z } from 'zod';

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

describe('Get Topic Messages Tool (unit)', () => {
  const context = { mirrornodeService: 'mockService' } as any;
  const mockMessages = [
    {
      message: Buffer.from('Hello world!').toString('base64'),
      consensus_timestamp: '1690000000.000000001',
    },
    {
      message: Buffer.from('Second message').toString('base64'),
      consensus_timestamp: '1690000001.000000001',
    },
  ];

  const mirrornodeMock = {
    getTopicMessages: vi.fn(async _params => ({
      topicId: '0.0.1234',
      messages: mockMessages,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedMirrorNode.mockReturnValue(mirrornodeMock as any);
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_TOPIC_MESSAGES_QUERY_TOOL);
    expect(tool.name).toBe('Get Topic Messages');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('context snippet');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns messages decoded from base64', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: '0.0.1234',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res.raw.topicId).toBe('0.0.1234');
    expect(res.raw.messages[0].message).toBe('Hello world!');
    expect(res.raw.messages[1].message).toBe('Second message');
    expect(res.humanMessage).toContain('Messages for topic 0.0.1234:');
  });

  it('returns error message when mirrornode fails', async () => {
    mirrornodeMock.getTopicMessages.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: '0.0.1234',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Network failure');
    expect(res.raw.error).toContain('Network failure');
  });

  it('returns generic error when non-error thrown', async () => {
    mirrornodeMock.getTopicMessages.mockImplementationOnce(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: '0.0.1234',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toBe('Failed to get topic messages');
    expect(res.raw.error).toBe('Failed to get topic messages');
  });
});
