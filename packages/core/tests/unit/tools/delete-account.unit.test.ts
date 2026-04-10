import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  DELETE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/delete-account';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseDeleteAccount: vi.fn((params: any) => ({ ...params })) },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { deleteAccount: vi.fn((_params: any) => ({ tx: 'deleteAccountTx' })) },
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
    getAccountParameterDescription: vi.fn(() => 'accountId (string): The account to delete'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

const makeClient = () => Client.forNetwork({});

describe('delete-account tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    accountId: '0.0.2002',
    transferAccountId: '0.0.3003',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(DELETE_ACCOUNT_TOOL);
    expect(tool.name).toBe('Delete Account');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will delete an existing Hedera account');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Account successfully deleted\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.deleteAccount).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseDeleteAccount).toHaveBeenCalledWith(
      params,
      context,
      client,
    );
  });

  it('returns error response object when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.deleteAccount as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res: any = await tool.execute(client, context, params as any);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to delete account');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to delete account');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.deleteAccount as any).mockImplementation(() => {
      throw 'string error';
    });

    const res: any = await tool.execute(client, context, params as any);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to delete account');
    expect(res.raw.error).toContain('Failed to delete account');
  });
});
