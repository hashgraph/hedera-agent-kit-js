import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/mint-non-fungible-token';
import z from 'zod';
import { mintNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';

// ---- MOCKS ----
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseMintNonFungibleTokenParams: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    mintNonFungibleToken: vi.fn(),
  },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
      tokenId: { toString: () => '0.0.5005' },
      transactionId: { toString: () => '0.0.1234@1700000000.000000001' },
    } as any;
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) } as any;
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide parameters as JSON.'),
    getContextSnippet: vi.fn(() => 'context'),
  },
}));

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forNetwork({});

// ---- TESTS ----
describe('mint-non-fungible-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> = {
    tokenId: '0.0.5005',
    uris: ['ipfs://abc123'],
  };

  const normalisedParams = {
    tokenId: '0.0.5005',
    uris: ['ipfs://abc123'],
    metadata: [new TextEncoder().encode('ipfs://abc123')],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(MINT_NON_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Mint Non-Fungible Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('mint NFTs with its unique metadata');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    mockedNormaliser.normaliseMintNonFungibleTokenParams.mockReturnValue(normalisedParams);
    mockedBuilder.mintNonFungibleToken.mockReturnValue({ tx: 'mintNftTx' } as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw.status).toBe('SUCCESS');
    expect(res.humanMessage).toContain('Token 0.0.5005 successfully minted');
    expect(res.humanMessage).toContain('transaction id 0.0.1234@');

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockedBuilder.mintNonFungibleToken).toHaveBeenCalledWith(normalisedParams);
    expect(mockedNormaliser.normaliseMintNonFungibleTokenParams).toHaveBeenCalledWith(
      params,
      context,
    );
  });

  it('returns error message when an Error is thrown', async () => {
    mockedBuilder.mintNonFungibleToken.mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('boom');
    expect(res.raw.error).toBe('boom');
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    mockedBuilder.mintNonFungibleToken.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Error minting non fungible token');
    expect(res.raw.error).toBe('Error minting non fungible token');
  });
});
