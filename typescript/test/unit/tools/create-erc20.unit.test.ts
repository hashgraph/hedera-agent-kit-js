import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, { CREATE_ERC20_TOOL } from '@/plugins/core-evm-plugin/tools/erc20/create-erc20';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import { z } from 'zod';
import { AgentMode } from '@/shared';

// ---- MOCKS ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseCreateERC20Params: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    executeTransaction: vi.fn(),
  },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 'SUCCESS',
      transactionId: '0.0.1234@1700000000.000000001',
      contractId: { toString: () => '0.0.5005' },
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) } as any;
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide parameters as JSON.'),
    getContextSnippet: vi.fn(() => 'some context'),
  },
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
describe('createERC20 tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mode: AgentMode.AUTONOMOUS };
  const params = {
    tokenName: 'MYTOKEN',
    tokenSymbol: 'MTK',
    decimals: 18,
    initialSupply: 1000,
  } as unknown as z.infer<ReturnType<typeof createERC20Parameters>>;

  const normalisedParams = {
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    decimals: params.decimals,
    initialSupply: params.initialSupply,
    contractId: '0.0.9999',
    functionParameters: new Uint8Array([0x01, 0x02, 0x03]), // must be Uint8Array
    gas: 3_000_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(CREATE_ERC20_TOOL);
    expect(tool.name).toBe('Create ERC20 Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool creates an ERC20 token');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns ERC20 address and message', async () => {
    mockedNormaliser.normaliseCreateERC20Params.mockReturnValue(normalisedParams);
    mockedBuilder.executeTransaction.mockReturnValue({} as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.erc20Address).toBe('0xabcdef'); // mocked TransactionRecordQuery result
    expect(res.humanMessage).toContain('ERC20 token created successfully');
    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
    expect(mockedBuilder.executeTransaction).toHaveBeenCalledOnce();
    expect(mockedNormaliser.normaliseCreateERC20Params).toHaveBeenCalledWith(
      params,
      expect.any(String),
      expect.any(Array),
      'deployToken',
      context,
    );
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

    expect(res.humanMessage).toBe('Failed to create ERC20 token');
    expect(res.raw.error).toBe('Failed to create ERC20 token');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });
});
