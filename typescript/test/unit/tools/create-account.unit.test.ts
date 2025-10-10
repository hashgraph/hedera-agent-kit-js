import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  CREATE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/create-account';

// 🔹 Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseCreateAccount: vi.fn((params: any) => ({ ...params })) },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { createAccount: vi.fn((_params: any) => ({ tx: 'createAccountTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      accountId: '0.111111',
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
    getAccountParameterDescription: vi.fn(() => 'publicKey (string): Account public key'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getScheduledTransactionParamsDescription: vi.fn(
      () =>
        '- schedulingParams (object, optional): Set isScheduled = true to make the transaction scheduled.',
    ),
  },
}));
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({})),
  default: {},
}));

const makeClient = () => {
  return Client.forNetwork({});
};

describe('create-account tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', accountPublicKey: '0xpublickey' };
  const params = {
    publicKey: '0xpublickey',
    accountMemo: 'unit test',
    initialBalance: 1,
    maxAutomaticTokenAssociations: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_ACCOUNT_TOOL);
    expect(tool.name).toBe('Create Account');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain(
      'This tool will create a new Hedera account with a passed public key. If not passed, the tool will use operators public key.',
    );
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Account created successfully\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);
    expect(res.humanMessage).toMatch(/New Account ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.createAccount).toHaveBeenCalledTimes(1);

    const { default: HederaParameterNormaliser } = await import(
      '@/shared/hedera-utils/hedera-parameter-normaliser'
    );
    expect(HederaParameterNormaliser.normaliseCreateAccount).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(), // mirrornodeService
    );
  });

  it('returns error response object when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.createAccount as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res: any = await tool.execute(client, context, params);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to create account');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw).toBeDefined();
    expect(res.raw.error).toContain('Failed to create account');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.createAccount as any).mockImplementation(() => {
      throw 'string error';
    });

    const res: any = await tool.execute(client, context, params);
    expect(res).toBeDefined();
    expect(res.humanMessage).toContain('Failed to create account');
    expect(res.raw.error).toContain('Failed to create account');
  });
});
