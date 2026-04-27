import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { GetExchangeRateQueryTool } from '@/plugins/core-misc-query-plugin/tools/queries/get-exchange-rate-query';
import type { Context } from '@/shared/configuration';
import { getOperatorClientForTests } from '@hashgraph/hedera-agent-kit-tests';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

describe('Get Exchange Rate', () => {
  let client: Client;

  beforeAll(async () => {
    client = getOperatorClientForTests();
  });

  afterAll(async () => {
    if (client) client.close();
  });

  it('should fetch the current exchange rate when no timestamp is provided', async () => {
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

  it('should fetch an exchange rate for a specific timestamp', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };
    const tool = new GetExchangeRateQueryTool(localContext);

    // Derive a timestamp the mirror node definitely has — works on any network
    // (local-node/Solo doesn't have pre-deploy history; testnet prunes old timestamps).
    const currentRes: any = await tool.execute(client, localContext, {});
    const timestamp = String(currentRes.raw.current_rate.expiration_time - 1);

    const res: any = await tool.execute(client, localContext, { timestamp });

    expect(res).toBeTruthy();
    expect(res.raw).toBeTruthy();
    expect(res.raw.current_rate).toBeTruthy();
    expect(typeof res.raw.current_rate.cent_equivalent).toBe('number');
    expect(typeof res.raw.current_rate.hbar_equivalent).toBe('number');
    expect(typeof res.raw.current_rate.expiration_time).toBe('number');
    expect(res.humanMessage).toContain('Details for timestamp:');
    expect(res.humanMessage).toContain('Current exchange rate');
  });

  it('should handle invalid timestamp input gracefully', async () => {
    const mirrornode = getMirrornodeService(undefined, client.ledgerId!);
    const localContext: Context = {
      accountId: client.operatorAccountId?.toString(),
      mirrornodeService: mirrornode,
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tool = new GetExchangeRateQueryTool(localContext);
    const res: any = await tool.execute(client, localContext, {
      timestamp: 'not-a-timestamp',
    });

    expect(res).toBeTruthy();
    expect(res.humanMessage).toContain('HTTP error! status: 400');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[GetExchangeRate] Error getting exchange rate',
      expect.objectContaining({ message: expect.stringContaining('HTTP error! status: 400') }),
    );
  });
});
