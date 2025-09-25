import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_PENDING_AIRDROP_TOOL,
} from '@/plugins/core-token-query-plugin/tools/queries/get-pending-airdrop-query';

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getAccountParameterDescription: vi.fn((_k: string) => 'accountId (str, optional): The account ID'),
  },
}));

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(),
  default: {},
}));

const makeClient = () => Client.forNetwork({});

describe('get-pending-airdrop-query tool (unit)', () => {
  const context: any = { mirrornodeService: {}, accountId: '0.0.1111' };
  const params = { accountId: '0.0.2222' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_PENDING_AIRDROP_TOOL);
    expect(tool.name).toBe('Get Pending Airdrops');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('pending airdrops');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const fakeResponse = {
      airdrops: [
        {
          amount: 100,
          receiver_id: '0.0.2222',
          sender_id: '0.0.3333',
          serial_number: null,
          timestamp: { from: '1700000000.000000000', to: null },
          token_id: '0.0.4444',
        },
      ],
      links: { next: null },
    };

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getPendingAirdrops: vi.fn().mockResolvedValue(fakeResponse),
    });

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw.accountId).toBe(params.accountId);
    expect(res.raw.pendingAirdrops).toEqual(fakeResponse);
    expect(res.humanMessage).toContain(`pending airdrops for account **${params.accountId}**`);
    expect(res.humanMessage).toContain('Token: 0.0.4444');
  });

  it('falls back to context or operator account when accountId missing', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getPendingAirdrops: vi.fn().mockResolvedValue({ airdrops: [], links: { next: null } }),
    });

    const res: any = await tool.execute(client, context, {} as any);
    expect(res.humanMessage).toContain('No pending airdrops');
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockImplementation(() => {
      throw new Error('mirror node fetch failed');
    });

    const res: any = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to get pending airdrops');
    expect(res.raw.error).toContain('Failed to get pending airdrops');
  });
});


