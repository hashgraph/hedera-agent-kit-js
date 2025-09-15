import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_ACCOUNT_QUERY_TOOL,
} from '@/plugins/core-account-query-plugin/tools/queries/get-account-query';

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

describe('get-account-query tool (unit)', () => {
  const context: any = { mirrornodeService: {} };
  const params = { accountId: '0.0.1234' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_ACCOUNT_QUERY_TOOL);
    expect(tool.name).toBe('Get Account Query');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will return the account information');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const fakeAccount = {
      accountId: '0.0.1234',
      accountPublicKey: '302a300506032b6570032100abcd',
      evmAddress: '0xabcdef',
      balance: { balance: 1000 },
    };

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getAccount: vi.fn().mockResolvedValue(fakeAccount),
    });

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toEqual({ accountId: params.accountId, account: fakeAccount });
    expect(res.humanMessage).toContain(`Details for ${fakeAccount.accountId}`);
    expect(res.humanMessage).toContain(`Balance: ${fakeAccount.balance.balance}`);
    expect(res.humanMessage).toContain(`Public Key: ${fakeAccount.accountPublicKey}`);
    expect(res.humanMessage).toContain(`EVM address: ${fakeAccount.evmAddress}`);
    expect(getMirrornodeService).toHaveBeenCalledWith(context.mirrornodeService, client.ledgerId);
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to get account query');
    expect(res.humanMessage).toContain('boom');
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockImplementation(() => {
      throw 'string error';
    });

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to get account query');
  });
});
