import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, Status } from '@hashgraph/sdk';
import toolFactory, {
  SIGN_SCHEDULE_TRANSACTION_TOOL,
} from '@/plugins/core-account-plugin/tools/account/sign-schedule-transaction';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { signScheduleTransaction: vi.fn((_params: any) => ({ tx: 'signScheduleTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      accountId: null,
      tokenId: null,
      transactionId: '0.0.1234@1700000000.000000001',
      topicId: null,
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

const makeClient = () => {
  return Client.forNetwork({});
};

describe('sign-schedule-transaction tool (unit)', () => {
  const context: any = { accountId: '0.0.1001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(SIGN_SCHEDULE_TRANSACTION_TOOL);
    expect(tool.name).toBe('Sign Scheduled Transaction');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will sign a scheduled transaction');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      scheduleId: '0.0.123456',
    };

    const res: any = await tool.execute(client, context, params);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Transaction successfully signed\./);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
    expect(handleTransaction).toHaveBeenCalledTimes(1);

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    expect(HederaBuilder.signScheduleTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns error message when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.signScheduleTransaction as any).mockImplementation(() => {
      throw new Error('Invalid schedule ID');
    });

    const res = await tool.execute(client, context, {
      scheduleId: '0.0.999999',
    } as any);
    expect(res.humanMessage).toBe('Failed to sign scheduled transaction: Invalid schedule ID');
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.signScheduleTransaction as any).mockImplementation(() => {
      throw 'string error';
    });

    const res = await tool.execute(client, context, {
      scheduleId: '0.0.123456',
    } as any);
    expect(res.humanMessage).toBe('Failed to sign scheduled transaction');
  });

  it('handles different schedule ID formats', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    // Reset the mock to return success for this test
    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.signScheduleTransaction as any).mockImplementation(() => ({
      tx: 'signScheduleTx',
    }));

    const testCases = ['0.0.123456', '0.0.1', '0.0.999999999'];

    for (const scheduleId of testCases) {
      const params = { scheduleId };
      const res: any = await tool.execute(client, context, params);

      expect(res).toBeDefined();
      expect(res.raw).toBeDefined();
      expect(res.humanMessage).toMatch(/Transaction successfully signed\./);
    }
  });

  it('logs error to console when error occurs', async () => {
    const tool = toolFactory(context);
    const client = makeClient();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.signScheduleTransaction as any).mockImplementation(() => {
      throw new Error('Test error');
    });

    await tool.execute(client, context, {
      scheduleId: '0.0.123456',
    } as any);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[sign_schedule_transaction_tool]',
      'Failed to sign scheduled transaction: Test error',
    );
    consoleSpy.mockRestore();
  });

  it('returns proper error status when transaction fails', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
    (HederaBuilder.signScheduleTransaction as any).mockImplementation(() => {
      throw new Error('Schedule not found');
    });

    const res = await tool.execute(client, context, {
      scheduleId: '0.0.999999',
    } as any);

    expect(res.raw.status).toBe(Status.InvalidTransaction);
    expect(res.humanMessage).toContain('Failed to sign scheduled transaction');
  });
});
