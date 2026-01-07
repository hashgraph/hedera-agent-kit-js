import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_HBAR_BALANCE_QUERY_TOOL,
} from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import BigNumber from 'bignumber.js';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseHbarBalanceParams: vi.fn((params: any) => ({ accountId: '0.0.1001', ...params })),
  },
}));
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getAccountHbarBalance: vi.fn(async (_: string) => new BigNumber(123.456789)),
  })),
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAccountParameterDescription: vi.fn(() => 'accountId (string): target account'),
    getParameterUsageInstructions: vi.fn(() => 'Usage...'),
  },
}));
vi.mock('@/shared/hedera-utils/hbar-conversion-utils', () => ({
  toHbar: (bn: BigNumber) => ({ toString: () => bn.toFixed() }),
}));

const makeClient = () => Client.forNetwork({});

describe('get-hbar-balance tool (unit)', () => {
  const context: any = { accountId: '0.0.42', mirrornodeService: 'default' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_HBAR_BALANCE_QUERY_TOOL);
    expect(tool.name).toBe('Get HBAR Balance');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('return the HBAR balance');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, { accountId: '0.0.1001' } as any);

    expect(res.raw).toEqual({ accountId: '0.0.1001', hbarBalance: '123.456789' });
    expect(res.humanMessage).toContain('Account 0.0.1001 has a balance of 123.456789 HBAR');

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseHbarBalanceParams).toHaveBeenCalled();
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getAccountHbarBalance: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const res: any = await tool.execute(client, context, { accountId: '0.0.x' } as any);
    expect(res.humanMessage).toContain('Failed to get HBAR balance');
    expect(res.humanMessage).toContain('boom');
  });

  it('returns aligned generic message when non-Error thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getAccountHbarBalance: vi.fn(async () => {
        throw 'nope';
      }),
    });

    const res: any = await tool.execute(client, context, { accountId: '0.0.x' } as any);
    expect(res.humanMessage).toBe('Failed to get HBAR balance');
  });
});
