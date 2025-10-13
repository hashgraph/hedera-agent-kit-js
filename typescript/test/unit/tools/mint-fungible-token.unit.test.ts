import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, {
  MINT_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/mint-fungible-token';
import z from 'zod';
import { mintFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';

// ---- MOCKS ----
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';

// Mock dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseMintFungibleTokenParams: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    mintFungibleToken: vi.fn(),
  },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
      transactionId: { toString: () => '0.0.1234@1700000000.000000001' },
    } as any;
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) } as any;
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
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
describe('mint-fungible-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params: z.infer<ReturnType<typeof mintFungibleTokenParameters>> = {
    tokenId: '0.0.5005',
    amount: 100,
  };

  const normalisedParams = {
    tokenId: '0.0.5005',
    amount: 10000, // assume 2 decimals scaling
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(MINT_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Mint Fungible Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('mint a given amount');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    mockedNormaliser.normaliseMintFungibleTokenParams.mockResolvedValue(normalisedParams);
    mockedBuilder.mintFungibleToken.mockReturnValue({ tx: 'mintTx' } as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Tokens successfully minted');
    expect(res.humanMessage).toContain('0.0.1234@');

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockedBuilder.mintFungibleToken).toHaveBeenCalledWith(normalisedParams);
    expect(mockedNormaliser.normaliseMintFungibleTokenParams).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('returns aligned error response when an Error is thrown', async () => {
    mockedBuilder.mintFungibleToken.mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to mint fungible token');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to mint fungible token');
    expect(res.raw.error).toContain('boom');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    mockedBuilder.mintFungibleToken.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to mint fungible token');
    expect(res.raw.error).toBe('Failed to mint fungible token');
  });
});
