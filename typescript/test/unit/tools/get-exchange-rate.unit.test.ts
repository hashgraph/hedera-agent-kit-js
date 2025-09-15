import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_EXCHANGE_RATE_TOOL,
} from '@/plugins/core-misc-query-plugin/tools/queries/get-exchange-rate-query';
import type { ExchangeRateResponse } from '@/shared/hedera-utils/mirrornode/types';

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getExchangeRate: vi.fn(
      async (_timestamp?: string) =>
        ({
          current_rate: {
            cent_equivalent: 300, // $3.00 for 100 HBAR -> $0.03 per HBAR
            hbar_equivalent: 100,
            expiration_time: 1_700_000_000, // seconds
          },
          next_rate: {
            cent_equivalent: 400, // $0.04 per HBAR
            hbar_equivalent: 100,
            expiration_time: 1_800_000_000,
          },
          timestamp: '1726000000.123456789',
        }) as ExchangeRateResponse,
    ),
  })),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getParameterUsageInstructions: vi.fn(() => 'Usage...'),
  },
}));

const makeClient = () => Client.forNetwork({});

describe('get-exchange-rate tool (unit)', () => {
  const context: any = { mirrornodeService: 'default' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_EXCHANGE_RATE_TOOL);
    expect(tool.name).toBe('Get Exchange Rate');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('HBAR exchange rate');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, {
      timestamp: '1726000000.123456789',
    } as any);

    expect(res.raw.current_rate.cent_equivalent).toBe(300);
    expect(res.raw.next_rate.cent_equivalent).toBe(400);
    expect(res.raw.timestamp).toBe('1726000000.123456789');

    expect(res.humanMessage).toContain('Details for timestamp: 1726000000.123456789');
    expect(res.humanMessage).toContain('Current exchange rate: 0.03');
    expect(res.humanMessage).toContain('Next exchange rate: 0.04');

    expect(res.humanMessage).toContain(new Date(1_700_000_000 * 1000).toISOString());
    expect(res.humanMessage).toContain(new Date(1_800_000_000 * 1000).toISOString());
  });

  it('returns error message string for Error thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getExchangeRate: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const res: any = await tool.execute(client, context, { timestamp: 'x' } as any);
    expect(res.humanMessage).toBe('boom');
    expect(res.raw.error).toBe('boom');
  });

  it('returns generic message when non-Error thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { getMirrornodeService } = await import(
      '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils'
    );
    (getMirrornodeService as any).mockReturnValue({
      getExchangeRate: vi.fn(async () => {
        throw 'nope';
      }),
    });

    const res: any = await tool.execute(client, context, {} as any);
    expect(res.humanMessage).toBe('Failed to get exchange rate');
    expect(res.raw.error).toBe('Failed to get exchange rate');
  });
});
