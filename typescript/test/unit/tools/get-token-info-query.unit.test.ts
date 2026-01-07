import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_TOKEN_INFO_QUERY_TOOL,
} from '@/plugins/core-token-query-plugin/tools/queries/get-token-info-query';

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(),
  default: {},
}));

const makeClient = () => Client.forNetwork({});

describe('get-token-info-query tool (unit)', () => {
  const context: any = { mirrornodeService: {} };
  const params = { tokenId: '0.0.1234567' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_TOKEN_INFO_QUERY_TOOL);
    expect(tool.name).toBe('Get Token Info');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain(
      'This tool will return the information for a given Hedera token',
    );
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const fakeToken = {
      token_id: '0.0.1234567',
      name: 'Test Token',
      symbol: 'TEST',
      type: 'FUNGIBLE_COMMON',
      decimals: '8',
      total_supply: '1000000000000',
      max_supply: '10000000000000',
      supply_type: 'FINITE',
      treasury_account_id: '0.0.1234',
      deleted: false,
      freeze_default: false,
      admin_key: { _type: 'ED25519', key: 'abcd1234' },
      supply_key: { _type: 'ED25519', key: 'efgh5678' },
      wipe_key: null,
      kyc_key: null,
      freeze_key: null,
      fee_schedule_key: null,
      pause_key: null,
      metadata_key: null,
      memo: 'Test token memo',
    };

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getTokenInfo: vi.fn().mockResolvedValue(fakeToken),
    });

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toEqual({
      tokenId: params.tokenId,
      tokenInfo: { ...fakeToken, token_id: params.tokenId },
    });
    expect(res.humanMessage).toContain(`${params.tokenId}`);
    expect(res.humanMessage).toContain(`Token Name**: ${fakeToken.name}`);
    expect(res.humanMessage).toContain(`Token Symbol**: ${fakeToken.symbol}`);
    expect(res.humanMessage).toContain(`Token Type**: ${fakeToken.type}`);
    expect(res.humanMessage).toContain(`Decimals**: ${fakeToken.decimals}`);
    expect(res.humanMessage).toContain(`Treasury Account ID**: ${fakeToken.treasury_account_id}`);
    expect(res.humanMessage).toContain(`Admin Key: ${fakeToken.admin_key.key}`);
    expect(res.humanMessage).toContain(`Supply Key: ${fakeToken.supply_key.key}`);
    expect(res.humanMessage).toContain(`Wipe Key: Not Set`);
    expect(res.humanMessage).toContain(`Memo**: ${fakeToken.memo}`);
    expect(getMirrornodeService).toHaveBeenCalledWith(context.mirrornodeService, client.ledgerId);
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockImplementation(() => {
      throw new Error('token not found');
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to get token info');
    expect(res.humanMessage).toContain('token not found');
    expect(res.raw.error).toContain('Failed to get token info');
    expect(res.raw.error).toContain('token not found');
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockImplementation(() => {
      throw 'string error';
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to get token info');
    expect(res.raw.error).toContain('Failed to get token info');
  });

  it('handles infinite supply tokens correctly', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const fakeTokenInfinite = {
      token_id: '0.0.1234567',
      name: 'Infinite Token',
      symbol: 'INF',
      type: 'FUNGIBLE_COMMON',
      decimals: '0',
      total_supply: '1000000',
      max_supply: null,
      supply_type: 'INFINITE',
      treasury_account_id: '0.0.1234',
      deleted: false,
      freeze_default: true,
      admin_key: null,
      supply_key: null,
      wipe_key: null,
      kyc_key: null,
      freeze_key: null,
      fee_schedule_key: null,
      pause_key: null,
      metadata_key: null,
      memo: null,
    };

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getTokenInfo: vi.fn().mockResolvedValue(fakeTokenInfinite),
    });

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Supply Type**: Infinite');
    expect(res.humanMessage).toContain('Status (Frozen/Active)**: Frozen');
    expect(res.humanMessage).toContain('Admin Key: Not Set');
    expect(res.humanMessage).not.toContain('Memo**:');
  });
});
