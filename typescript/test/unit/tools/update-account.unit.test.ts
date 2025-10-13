import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  UPDATE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/update-account';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseUpdateAccount: vi.fn((params: any) => ({ ...params })) },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { updateAccount: vi.fn((_params: any) => ({ tx: 'updateAccountTx' })) },
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
    getAccountParameterDescription: vi.fn(() => 'accountId (string): Account to update'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getScheduledTransactionParamsDescription: vi.fn(() => 'mocked scheduled params desc'),
  },
}));

const makeClient = () => Client.forNetwork({});

describe('update-account tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    accountId: '0.0.2002',
    accountMemo: 'updated memo',
    maxAutomaticTokenAssociations: 5,
    declineStakingReward: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(UPDATE_ACCOUNT_TOOL);
    expect(tool.name).toBe('Update Account');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('update an existing Hedera account');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Account successfully updated\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.updateAccount).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseUpdateAccount).toHaveBeenCalledWith(
      params,
      context,
      client,
    );
  });

  it('returns error response object when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.updateAccount as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res: any = await tool.execute(client, context, params as any);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to update account');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to update account');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.updateAccount as any).mockImplementation(() => {
      throw 'string error';
    });

    const res: any = await tool.execute(client, context, params as any);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to update account');
    expect(res.raw.error).toContain('Failed to update account');
  });
});
