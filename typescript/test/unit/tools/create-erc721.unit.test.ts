import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, {
  CREATE_ERC721_TOOL,
} from '@/plugins/core-evm-plugin/tools/erc721/create-erc721';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import { z } from 'zod';
import { AgentMode } from '@/shared';

// ---- MOCKS ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseCreateERC721Params: vi.fn(),
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
    } as any;
  }),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide parameters as JSON.'),
    getContextSnippet: vi.fn(() => 'some context'),
    getScheduledTransactionParamsDescription: vi.fn(() => 'Schedule description.'),
  },
}));

vi.mock('@/shared/constants/contracts', () => ({
  getERC721FactoryAddress: vi.fn(() => '0.0.9999'),
  ERC721_FACTORY_ABI: [{ name: 'deployToken', type: 'function' }],
}));

vi.mock('@hashgraph/sdk', async () => {
  const actual: any = await vi.importActual('@hashgraph/sdk');
  return {
    ...actual,
    TransactionRecordQuery: vi.fn(() => ({
      setTransactionId: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({
        contractFunctionResult: { getAddress: vi.fn(() => 'abcdef') },
      }),
    })),
  };
});

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forTestnet();

// ---- TESTS ----
describe('createERC721 tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mode: AgentMode.AUTONOMOUS };
  const params = {
    tokenName: 'MYNFT',
    tokenSymbol: 'MNFT',
    baseURI: 'https://example.com/metadata/',
  } as unknown as z.infer<ReturnType<typeof createERC721Parameters>>;

  const normalisedParams = {
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    baseURI: params.baseURI,
    contractId: '0.0.9999',
    functionParameters: new Uint8Array([0x01, 0x02, 0x03]),
    gas: 3_000_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_ERC721_TOOL);
    expect(tool.name).toBe('Create ERC721 Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool creates an ERC721 token');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns ERC721 address and message', async () => {
    mockedNormaliser.normaliseCreateERC721Params.mockResolvedValue(normalisedParams);
    mockedBuilder.executeTransaction.mockReturnValue({} as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.erc721Address).toBe('0xabcdef');
    expect(res.humanMessage).toContain('ERC721 token created successfully');
    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
    expect(mockedBuilder.executeTransaction).toHaveBeenCalledOnce();
    expect(mockedNormaliser.normaliseCreateERC721Params).toHaveBeenCalledWith(
      params,
      '0.0.9999',
      expect.any(Array),
      'deployToken',
      context,
      client,
    );
  });

  it('returns early when in RETURN_BYTES mode', async () => {
    mockedNormaliser.normaliseCreateERC721Params.mockResolvedValue(normalisedParams);
    mockedBuilder.executeTransaction.mockReturnValue({} as any);

    const customContext: any = { accountId: '0.0.1001', mode: AgentMode.RETURN_BYTES };
    const tool = toolFactory(customContext);
    const client = makeClient();

    const res = await tool.execute(client, customContext, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.erc721Address).toBeUndefined();
    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
  });

  it('returns error message when an Error is thrown', async () => {
    mockedBuilder.executeTransaction.mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('boom');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    mockedBuilder.executeTransaction.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Failed to create ERC721 token');
    expect(res.raw.error).toContain('Failed to create ERC721 token');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });
});
