import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId, Key } from '@hashgraph/sdk';
import getHbarBalanceTool from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/query.zod';
import { wait } from '../../utils/general-utils';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';

describe('Get HBAR Balance Integration Tests', () => {
  let client: Client;
  let context: Context;
  let operatorAccountId: AccountId;
  let recipientAccountId: AccountId;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getClientForTests();
    operatorAccountId = client.operatorAccountId!;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    recipientAccountId = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: 1,
      })
      .then(resp => resp.accountId!);

    // wait for the mirror node to be updated
    await wait(4000);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: operatorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (client) {
      await hederaOperationsWrapper.deleteAccount({
        accountId: recipientAccountId,
        transferAccountId: operatorAccountId,
      });
      client.close();
    }
  });

  it('should return balance for specified account', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: recipientAccountId.toString(),
    } as any;

    const tool = getHbarBalanceTool(context);
    const res: any = await tool.execute(client, context, params);

    expect(res.raw.accountId).toBe(recipientAccountId.toString());
    expect(Number(res.raw.hbarBalance)).toBe(1);
    expect(res.humanMessage).toContain(`Account ${recipientAccountId.toString()} has a balance of`);
  });

  it('should use default account when accountId not provided', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {} as any;
    const operatorAccountBalance = await hederaOperationsWrapper.getAccountHbarBalance(
      operatorAccountId.toString(),
    );

    const tool = getHbarBalanceTool({ ...context, accountId: operatorAccountId.toString() });
    const res: any = await tool.execute(client, context, params);

    expect(res.raw.accountId).toBe(operatorAccountId.toString());
    expect(Number(res.raw.hbarBalance)).toBe(toDisplayUnit(operatorAccountBalance, 8).toNumber());
  });

  it('should handle not finding provided account', async () => {
    const nonExistentAccountId = '0.0.999999999999';
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: nonExistentAccountId,
    } as any;

    const tool = getHbarBalanceTool({ ...context, accountId: operatorAccountId.toString() });
    const res: any = await tool.execute(client, context, params);

    expect(res.raw.accountId).toBe(nonExistentAccountId);
    expect(res.humanMessage).toContain(`Failed to fetch hbar balance for`);
  });
});
