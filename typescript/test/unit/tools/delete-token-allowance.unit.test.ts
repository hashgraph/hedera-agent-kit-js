import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, {
  DELETE_TOKEN_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/delete-token-allowance';

// ---- Mocks ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseDeleteTokenAllowance: vi.fn((params: any) => ({ normalised: true, ...params })),
  },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    approveTokenAllowance: vi.fn((_params: any) => ({
      execute: async () => ({
        transactionId: '0.0.9999@1700000000.000000001',
        status: 22,
      }),
    })),
  },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      accountId: null,
      tokenId: null,
      transactionId: '0.0.12345@1700000000.000000002',
      topicId: null,
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAccountParameterDescription: vi.fn(() => 'ownerAccountId (string): Owner account ID'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

// Mock Mirror Node Service
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getTokenInfo: vi.fn(async (tokenId: string) => ({
      tokenId,
      decimals: 0,
    })),
  })),
}));

// ---- Helpers ----
const makeClient = () => Client.forNetwork({});

describe('delete-token-allowance tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mirrornodeService: 'mockService' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(DELETE_TOKEN_ALLOWANCE_TOOL);
    expect(tool.name).toBe('Delete Token Allowance');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('deletes token allowance');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      ownerAccountId: '0.0.1001',
      spenderAccountId: '0.0.2002',
      tokenIds: ['0.0.3003', '0.0.4004'],
      transactionMemo: 'unit test delete token allowance',
    };

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Token allowance\(s\) deleted successfully\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.approveTokenAllowance).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseDeleteTokenAllowance).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('handles errors gracefully and returns structured error response', async () => {
    // Simulate normaliser throwing an error
    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    (HederaParameterNormaliser.normaliseDeleteTokenAllowance as any).mockImplementationOnce(() => {
      throw new Error('Test normaliser failure');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      ownerAccountId: '0.0.1001',
      spenderAccountId: '0.0.2002',
      tokenIds: ['0.0.1234'],
    };

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw.status).toBe(Status.InvalidTransaction);
    expect(res.humanMessage).toContain('Failed to delete token allowance');
    expect(res.humanMessage).toContain('Test normaliser failure');
  });
});
