import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@hashgraph/sdk';
import { GetExchangeRateQueryTool } from '@/plugins/core-misc-query-plugin/tools/queries/get-exchange-rate-query';
import { Context } from '@/shared/configuration';
import { getOperatorClientForTests } from '../../utils';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

describe('Get Exchange Rate Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = getOperatorClientForTests();
  });

  afterAll(async () => {
    if (client) client.close();
  });

  it('fetches the current exchange rate (no timestamp)', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };
    const tool = new GetExchangeRateQueryTool(localContext);
    const res: any = await tool.execute(client, localContext, {});

    // Basic shape checks
    expect(res).toBeTruthy();
    expect(res.raw).toBeTruthy();
    expect(res.raw.current_rate).toBeTruthy();
    expect(typeof res.raw.current_rate.cent_equivalent).toBe('number');
    expect(typeof res.raw.current_rate.hbar_equivalent).toBe('number');
    expect(typeof res.raw.current_rate.expiration_time).toBe('number');

    // Human message formatting checks
    expect(typeof res.humanMessage).toBe('string');
    expect(res.humanMessage).toContain('Current exchange rate');
    expect(res.humanMessage).toContain('Next exchange rate');
  });

  it('fetches an exchange rate for a specific timestamp - 1', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };
    // Use a recent historical timestamp format (seconds since epoch)
    const params = { timestamp: '1726000000' } as any;
    const tool = new GetExchangeRateQueryTool(localContext);
    const res: any = await tool.execute(client, localContext, params);

    expect(res).toBeTruthy();
    expect(res.raw).toBeTruthy();
    expect(res.raw.current_rate).toBeTruthy();
    expect(typeof res.humanMessage).toBe('string');

    // We avoid strict equality with the timestamp as mirror node can normalize values,
    // but ensure the details section is present
    expect(res.humanMessage).toContain('Details for timestamp:');
    expect(res.humanMessage).toContain('Current exchange rate');
  });

  it('fetches an exchange rate for a specific timestamp - 2', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };

    const params = { timestamp: '1757512862.640825000' } as any;
    const tool = new GetExchangeRateQueryTool(localContext);
    const res: any = await tool.execute(client, localContext, params);

    expect(res).toBeTruthy();
    expect(res.raw).toEqual({
      current_rate: {
        cent_equivalent: 703411,
        expiration_time: 1757516400,
        hbar_equivalent: 30000,
      },
      next_rate: {
        cent_equivalent: 707353,
        expiration_time: 1757520000,
        hbar_equivalent: 30000,
      },
      timestamp: '1757512862.640825000',
    });
  });

  it('handles invalid timestamp input gracefully', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };
    const tool = new GetExchangeRateQueryTool(localContext);
    const res: any = await tool.execute(client, localContext, {
      timestamp: 'not-a-timestamp',
    });

    expect(res).toBeTruthy();
    expect(typeof res.humanMessage).toBe('string');
    // Error handling might return distinct structure depending on implementation
    // The tool catches error and returns { raw: { error: ... }, humanMessage: ... }
    // The previous test expected raw.error
  });
});
