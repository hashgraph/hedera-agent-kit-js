import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, PublicKey } from '@hashgraph/sdk';
import toolFactory, { UPDATE_TOKEN_TOOL } from '@/plugins/core-token-plugin/tools/update-token';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import { AccountResolver } from '@/shared';

// Define a single consistent key for testing
const TEST_PUBLIC_KEY = PublicKey.fromString(
  '302a300506032b6570032100aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
);

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- Mocks for dependencies ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseUpdateToken: vi.fn((params: any) => ({ ...params })) },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { updateToken: vi.fn((_params: any) => ({ tx: 'updateTokenTx' })) },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      tokenId: '0.0.3003',
      transactionId: '0.0.1234@1700000000.000000001',
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getTokenInfo: vi.fn(async (_tokenId: string) => ({
      admin_key: { key: TEST_PUBLIC_KEY.toStringRaw() },
      kyc_key: null,
      freeze_key: null,
      wipe_key: null,
      supply_key: null,
      fee_schedule_key: null,
      pause_key: null,
      metadata_key: null,
    })),
  })),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAnyAddressParameterDescription: vi.fn(() => 'tokenId (string): Token to update'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

vi.mock('@/shared', async () => {
  const actual = await vi.importActual('@/shared');
  return {
    ...actual,
    AccountResolver: {
      getDefaultPublicKey: vi.fn(async (_context: any, _client: any) => TEST_PUBLIC_KEY),
    },
  };
});

// ---- HELPERS ----
const makeClient = () => Client.forNetwork({});

// ---- TESTS ----
describe('update-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    tokenId: '0.0.3003',
    tokenName: 'UpdatedToken',
    tokenSymbol: 'UTK',
    adminKey: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(UPDATE_TOKEN_TOOL);
    expect(tool.name).toBe('Update Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('update an existing Hedera HTS token');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Token successfully updated/);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
    expect(mockedBuilder.updateToken).toHaveBeenCalledOnce();
    expect(mockedNormaliser.normaliseUpdateToken).toHaveBeenCalledWith(params, context, client);
  });

  it('returns error response object when an Error is thrown', async () => {
    mockedBuilder.updateToken.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);
    expect(res.humanMessage).toContain('Failed to update token');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to update token');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    mockedBuilder.updateToken.mockImplementationOnce(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);
    expect(res.humanMessage).toContain('Failed to update token');
    expect(res.raw.error).toContain('Failed to update token');
  });

  it('fails if the user public key does not match the token admin key', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    // Mock AccountResolver to return a different key
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValueOnce(
      PublicKey.fromString(
        '302a300506032b6570032100deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ),
    );

    const res: any = await tool.execute(client, context, params as any);

    expect(res.humanMessage).toContain('You do not have permission');
    expect(res.raw.error).toContain('You do not have permission');
  });
});
