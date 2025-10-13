import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, PublicKey, TokenSupplyType, TokenType } from '@hashgraph/sdk';
import toolFactory, {
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/create-non-fungible-token';
import z from 'zod';
import {
  createNonFungibleTokenParameters,
  createNonFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';

// ---- MOCKS ----
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';

// Mock the modules
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseCreateNonFungibleTokenParams: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    createNonFungibleToken: vi.fn(),
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
      () => 'treasuryAccountId (string): The treasury account for the token',
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
describe('create-non-fungible-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params = {
    tokenName: 'MYNFT',
    tokenSymbol: 'MNFT',
    maxSupply: 100,
  } as unknown as z.infer<ReturnType<typeof createNonFungibleTokenParameters>>;

  const normalisedParams: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>> = {
    supplyType: TokenSupplyType.Finite,
    adminKey: undefined,
    autoRenewAccountId: '',
    freezeKey: undefined,
    kycKey: undefined,
    pauseKey: undefined,
    supplyKey: PublicKey.unusableKey(),
    tokenMemo: undefined,
    tokenType: TokenType.NonFungibleUnique,
    treasuryAccountId: context.accountId,
    wipeKey: undefined,
    tokenName: 'MYNFT',
    tokenSymbol: 'MNFT',
    maxSupply: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_NON_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Create Non-Fungible Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool creates a non-fungible token (NFT) on Hedera.');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx and token id', async () => {
    mockedNormaliser.normaliseCreateNonFungibleTokenParams.mockImplementation(
      async () => normalisedParams,
    );
    mockedBuilder.createNonFungibleToken.mockReturnValue({ tx: 'createNFTTx' } as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Token created successfully');
    expect(res.humanMessage).toContain('0.0.1234@');

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockedBuilder.createNonFungibleToken).toHaveBeenCalledTimes(1);
    expect(mockedNormaliser.normaliseCreateNonFungibleTokenParams).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('returns aligned error response when an Error is thrown', async () => {
    mockedBuilder.createNonFungibleToken.mockImplementation(() => {
      throw new Error('NFT creation failed');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to create non-fungible token');
    expect(res.humanMessage).toContain('NFT creation failed');
    expect(res.raw.error).toContain('Failed to create non-fungible token');
    expect(res.raw.error).toContain('NFT creation failed');
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    mockedBuilder.createNonFungibleToken.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to create non-fungible token');
    expect(res.raw.error).toBe('Failed to create non-fungible token');
  });
});
