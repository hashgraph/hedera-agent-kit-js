import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  TRANSFER_HBAR_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseTransferHbar: vi.fn((params: any) => ({ normalised: true, ...params })) },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { transferHbar: vi.fn((_params: any) => ({ tx: 'transferTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      accountId: null,
      tokenId: null,
      transactionId: '0.0.1234@1700000000.000000001',
      topicId: null,
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAccountParameterDescription: vi.fn(() => 'sourceAccountId (string): Sender account ID'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getScheduledTransactionParamsDescription: vi.fn(() => 'mocked scheduled params desc'),
  },
}));

const makeClient = () => {
  return Client.forNetwork({});
};

describe('transfer-hbar tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(TRANSFER_HBAR_TOOL);
    expect(tool.name).toBe('Transfer HBAR');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will transfer HBAR');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      transfers: [{ accountId: '0.0.2002', amount: 1 }],
      sourceAccountId: '0.0.1001',
      transactionMemo: 'unit test',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/HBAR successfully transferred\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.transferHbar).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseTransferHbar).toHaveBeenCalledWith(
      params,
      context,
      client,
    );
  });

  it('returns aligned error response when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.transferHbar as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await tool.execute(client, context, {
      transfers: [{ accountId: '0.0.9', amount: 1 }],
    } as any);
    expect(res.humanMessage).toContain('Failed to transfer HBAR');
    expect(res.humanMessage).toContain('boom');
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.transferHbar as any).mockImplementation(() => {
      throw 'string error';
    });

    const res = await tool.execute(client, context, {
      transfers: [{ accountId: '0.0.9', amount: 1 }],
    } as any);
    expect(res.humanMessage).toBe('Failed to transfer HBAR');
  });
});
