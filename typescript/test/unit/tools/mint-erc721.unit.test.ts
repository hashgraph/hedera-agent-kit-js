import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, { MINT_ERC721_TOOL } from '@/plugins/core-evm-plugin/tools/erc721/mint-erc721';
import { mintERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import * as MirrornodeUtils from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { z } from 'zod';
import { AgentMode, ERC721_MINT_FUNCTION_NAME } from '@/shared';

// ---- MOCKS ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseMintERC721Params: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    executeTransaction: vi.fn(),
  },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any) => {
    return {
      raw: {
        status: 'SUCCESS',
        transactionId: '0.0.1234@1700000000.000000001',
      },
      humanMessage: 'ERC721 token minted successfully',
    } as any;
  }),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide parameters as JSON.'),
    getContextSnippet: vi.fn(() => 'some context'),
    getAnyAddressParameterDescription: vi.fn(
      () => 'toAddress (str, optional): The address to which the token will be minted.',
    ),
    getScheduledTransactionParamsDescription: vi.fn(
      () =>
        '- schedulingParams (object, optional): Set isScheduled = true to make the transaction scheduled.',
    ),
  },
}));

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getAccount: vi.fn(),
  })),
}));

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });
const mockedMirrornodeUtils = vi.mocked(MirrornodeUtils, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forTestnet();

// ---- TESTS ----
describe('mintERC721 tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mode: AgentMode.AUTONOMOUS };
  const params = {
    contractId: '0.0.5678',
    toAddress: '0x1234567890123456789012345678901234567890',
  } as unknown as z.infer<ReturnType<typeof mintERC721Parameters>>;

  const normalisedParams = {
    contractId: '0.0.5678',
    functionParameters: new Uint8Array([0x01, 0x02, 0x03]),
    gas: 100_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedMirrornodeUtils.getMirrornodeService.mockReturnValue({
      getAccount: vi.fn(),
    } as any);
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(MINT_ERC721_TOOL);
    expect(tool.name).toBe('Mint ERC721');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will mint a new ERC721 token');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns success message', async () => {
    mockedNormaliser.normaliseMintERC721Params.mockResolvedValue(normalisedParams);
    mockedBuilder.executeTransaction.mockReturnValue({} as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toBe('ERC721 token minted successfully');
    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
    expect(mockedBuilder.executeTransaction).toHaveBeenCalledOnce();
    expect(mockedNormaliser.normaliseMintERC721Params).toHaveBeenCalledWith(
      params,
      expect.any(Array),
      ERC721_MINT_FUNCTION_NAME,
      context,
      expect.any(Object),
      client,
    );
  });

  it('returns error message when an Error is thrown', async () => {
    mockedBuilder.executeTransaction.mockImplementation(() => {
      throw new Error('mint failed');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('mint failed');
    expect(res.raw.error).toContain('mint failed');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    mockedBuilder.executeTransaction.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toBe('Failed to mint ERC721');
    expect(res.raw.error).toBe('Failed to mint ERC721');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('handles parameter validation errors', async () => {
    mockedNormaliser.normaliseMintERC721Params.mockRejectedValue(
      new Error('Invalid parameters: Field "toAddress" - Invalid address'),
    );

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Invalid parameters: Field "toAddress" - Invalid address');
    expect(res.raw.error).toContain('Invalid parameters: Field "toAddress" - Invalid address');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('handles address resolution errors', async () => {
    mockedNormaliser.normaliseMintERC721Params.mockRejectedValue(
      new Error('Account not found: 0.0.9999'),
    );

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Account not found: 0.0.9999');
    expect(res.raw.error).toContain('Account not found: 0.0.9999');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });
});
