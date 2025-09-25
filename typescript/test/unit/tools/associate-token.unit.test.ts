import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, { ASSOCIATE_TOKEN_TOOL } from '@/plugins/core-token-plugin/tools/associate-token';
import z from 'zod';
import { associateTokenParameters } from '@/shared/parameter-schemas/token.zod';

// ---- MOCKS ----
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseAssociateTokenParams: vi.fn(),
  },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: {
    associateToken: vi.fn(),
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
    getAnyAddressParameterDescription: vi.fn(
      () =>
        `- accountId (str, optional): The Hedera account ID or EVM address. If not provided, defaults to the operator account`,
    ),
  },
}));

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- HELPERS ---
const makeClient = () => Client.forNetwork({});

// ---- TESTS ----
describe('associate-token tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };
  const params: z.infer<ReturnType<typeof associateTokenParameters>> = {
    tokenIds: ['0.0.5005', '0.0.6006'],
  } as any;

  const normalisedParams = {
    accountId: '0.0.1001',
    tokenIds: ['0.0.5005', '0.0.6006'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(ASSOCIATE_TOKEN_TOOL);
    expect(tool.name).toBe('Associate Token(s)');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('associate one or more tokens');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message', async () => {
    mockedNormaliser.normaliseAssociateTokenParams.mockReturnValue(normalisedParams as any);
    mockedBuilder.associateToken.mockReturnValue({ tx: 'associateTx' } as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toContain('Tokens successfully associated with transaction id');
    expect(res.humanMessage).toContain('0.0.1234@');

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledTimes(1);
    expect(mockedBuilder.associateToken).toHaveBeenCalledWith(normalisedParams);
    expect(mockedNormaliser.normaliseAssociateTokenParams).toHaveBeenCalledWith(
      params,
      context,
      expect.anything(),
    );
  });

  it('returns aligned error response when an Error is thrown', async () => {
    mockedBuilder.associateToken.mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toContain('Failed to associate token');
    expect(res.humanMessage).toContain('boom');
    expect(res.raw.error).toContain('Failed to associate token');
    expect(res.raw.error).toContain('boom');
    expect(res.raw.status).toBe(Status.InvalidTransaction);
  });

  it('returns aligned generic failure response when a non-Error is thrown', async () => {
    mockedBuilder.associateToken.mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res = await tool.execute(client, context, params);
    expect(res.humanMessage).toBe('Failed to associate token(s)');
    expect(res.raw.error).toBe('Failed to associate token(s)');
  });
});


