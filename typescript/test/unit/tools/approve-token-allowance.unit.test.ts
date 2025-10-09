import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  APPROVE_TOKEN_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';

// ---- Mocks ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseApproveTokenAllowance: vi.fn((params: any) => ({
      ownerAccountId: params.ownerAccountId,
      spenderAccountId: params.spenderAccountId,
      tokenAllowances: params.tokenAllowances.map((t: any) => ({
        tokenId: { toString: () => t.tokenId },
        amount: t.amount,
        ownerAccountId: params.ownerAccountId,
        spenderAccountId: params.spenderAccountId,
      })),
      transactionMemo: params.transactionMemo,
    })),
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
      transactionId: '0.0.2345@1700000000.000000002',
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

const makeClient = () => Client.forNetwork({});

describe('approve-token-allowance tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mirrornodeService: 'mockService' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(APPROVE_TOKEN_ALLOWANCE_TOOL);
    expect(tool.name).toBe('Approve Token Allowance');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('approves allowances for one or more fungible tokens');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      ownerAccountId: '0.0.1001',
      spenderAccountId: '0.0.2002',
      tokenAllowances: [
        { tokenId: '0.0.3003', amount: 100 },
        { tokenId: '0.0.3004', amount: 1 },
      ],
      transactionMemo: 'unit test token allowance',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/allowance\(s\) approved successfully\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.approveTokenAllowance).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseApproveTokenAllowance).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(), // mirror node service
    );
  });
});
