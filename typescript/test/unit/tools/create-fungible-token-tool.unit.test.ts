import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status, TokenSupplyType } from '@hashgraph/sdk';
import toolFactory, {
  CREATE_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/create-fungible-token';
import z from 'zod';
import {
  createFungibleTokenParameters,
  createFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';

// ---- MOCKS ----
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';

// Mock the modules
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseCreateFungibleTokenParams: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    createFungibleToken: vi.fn(),
  },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
      accountId: null,
      tokenId: { toString: () => '0.0.5005' },
      transactionId: '0.0.1234@1700000000.000000001',
      topicId: null,
    } as any;
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) } as any;
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    getAccountParameterDescription: vi.fn(
      () => 'accountId (string): The account to create the token',
    ),
    getContextSnippet: vi.fn(() => 'some context'),
    getScheduledTransactionParamsDescription: vi.fn(() => 'mocked scheduled params desc'),
  },
}));

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({})),
}));

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forNetwork({});

// ---- TESTS ----
describe('create-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    tokenName: 'MYTOKEN',
    tokenSymbol: 'MTK',
    decimals: 0,
    isSubmitKey: true,
  } as unknown as z.infer<ReturnType<typeof createFungibleTokenParameters>>;

  const normalisedParams: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>> = {
    adminKey: undefined,
    autoRenewAccountId: undefined,
    freezeKey: undefined,
    initialSupply: 0,
    kycKey: undefined,
    maxSupply: undefined,
    metadataKey: undefined,
    pauseKey: undefined,
    supplyKey: undefined,
    tokenMemo: undefined,
    tokenType: undefined,
    treasuryAccountId: context.accountId,
    wipeKey: undefined,
    supplyType: TokenSupplyType.Finite,
    tokenName: 'MYTOKEN',
    tokenSymbol: 'MTK',
    decimals: 0,
    isSupplyKey: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Create Fungible Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool creates a fungible token on Hedera.');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx and token id', async () => {
    mockedNormaliser.normaliseCreateFungibleTokenParams.mockImplementation(
      async () => normalisedParams,
    );
    mockedBuilder.createFungibleToken.mockReturnValue({ tx: 'createTokenTx' } as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Token created successfully.');
    expect(res.humanMessage).toContain('0.0.1234@');

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockedBuilder.createFungibleToken).toHaveBeenCalledTimes(1);
    expect(mockedNormaliser.normaliseCreateFungibleTokenParams).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('returns aligned error response when an Error is thrown', async () => {
    mockedBuilder.createFungibleToken.mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to create fungible token');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to create fungible token');
    expect(res.raw.error).toContain('boom');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    mockedBuilder.createFungibleToken.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to create fungible token');
    expect(res.raw.error).toBe('Failed to create fungible token');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });
});
