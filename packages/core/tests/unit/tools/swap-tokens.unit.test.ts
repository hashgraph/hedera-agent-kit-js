import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountId, Client, PrivateKey } from '@hiero-ledger/sdk';
import toolFactory, { SWAP_TOKENS_TOOL } from '@/plugins/core-dex-plugin/tools/swap-tokens';
import { swapExactTokensForTokensParameters } from '@/shared/parameter-schemas/dex.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import * as MirrornodeUtils from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { z } from 'zod';
import { AgentMode } from '@/shared/configuration';

// ---- MOCKS ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseSwapExactTokensForTokensParams: vi.fn(),
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
      humanMessage: 'Token swap submitted successfully.',
    } as any;
  }),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide parameters as JSON.'),
    getContextSnippet: vi.fn(() => 'some context'),
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

// ---- HELPERS ----
// ECDSA operator is required by the swap tool (EVM contract call).
const makeClient = () =>
  Client.forTestnet().setOperator(AccountId.fromString('0.0.1001'), PrivateKey.generateECDSA());

// ---- TESTS ----
describe('swapTokens tool (unit)', () => {
  const context: any = { accountId: '0.0.1001', mode: AgentMode.AUTONOMOUS };
  const params = {
    routerContractId: '0.0.12345',
    path: ['0.0.111', '0.0.222'],
    amountIn: '100000000',
    amountOutMin: '95000000',
  } as unknown as z.infer<ReturnType<typeof swapExactTokensForTokensParameters>>;

  const normalisedParams = {
    contractId: '0.0.12345',
    functionParameters: new Uint8Array([0x01, 0x02, 0x03]),
    gas: 1_000_000,
    schedulingParams: { isScheduled: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedMirrornodeUtils.getMirrornodeService.mockReturnValue({
      getAccount: vi.fn(),
    } as any);
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(SWAP_TOKENS_TOOL);
    expect(tool.name).toBe('Swap Tokens');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('swapExactTokensForTokens');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns success message', async () => {
    mockedNormaliser.normaliseSwapExactTokensForTokensParams.mockResolvedValue(normalisedParams);
    mockedBuilder.executeTransaction.mockReturnValue({} as any);

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toBe('Token swap submitted successfully.');
    expect(mockedNormaliser.normaliseSwapExactTokensForTokensParams).toHaveBeenCalledOnce();
    expect(mockedBuilder.executeTransaction).toHaveBeenCalledOnce();
    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
  });

  it('returns a friendly error when normalisation fails', async () => {
    mockedNormaliser.normaliseSwapExactTokensForTokensParams.mockRejectedValue(
      new Error('boom'),
    );

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params);

    expect(res.humanMessage).toContain('Failed to swap tokens');
    expect(res.humanMessage).toContain('boom');
    expect(mockedBuilder.executeTransaction).not.toHaveBeenCalled();
  });
});
