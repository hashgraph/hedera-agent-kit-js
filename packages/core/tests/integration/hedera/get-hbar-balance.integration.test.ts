import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId, Key } from '@hiero-ledger/sdk';
import getHbarBalanceTool from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';

describe('Get HBAR Balance Integration Tests (Executor Account)', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let recipientAccountId: AccountId;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Create a recipient account via executor
    const createAcctResp = await executorWrapper.createAccount({
      key: executor.privateKey.publicKey as Key,
      initialBalance: profile.balance.usdToHbar(0.1),
    });
    recipientAccountId = createAcctResp.accountId!;

    await waitForMirrorTx(executorWrapper, createAcctResp.transactionId!); // wait for mirror node indexing

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('should return balance for the recipient account', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: recipientAccountId.toString(),
    } as any;

    const tool = getHbarBalanceTool(context);
    const res: any = await tool.execute(executorClient, context, params);

    const expectedBalance = profile.balance.usdToHbar(0.1);
    expect(res.raw.accountId).toBe(recipientAccountId.toString());
    expect(Number(res.raw.hbarBalance)).toBe(expectedBalance);
    expect(res.humanMessage).toContain(`Account ${recipientAccountId.toString()} has a balance of`);
  });

  it('should use default executor account when accountId not provided', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {} as any;
    const executorBalance = await executorWrapper.getAccountHbarBalance(
      executor.accountId.toString(),
    );

    const tool = getHbarBalanceTool({
      ...context,
      accountId: executor.accountId.toString(),
    });
    const res: any = await tool.execute(executorClient, context, params);

    expect(res.raw.accountId).toBe(executor.accountId.toString());
    expect(Number(res.raw.hbarBalance)).toBe(toDisplayUnit(executorBalance, 8).toNumber());
  });

  it('should handle not finding a non-existent account', async () => {
    const nonExistentAccountId = '0.0.999999999999';
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: nonExistentAccountId,
    } as any;

    const tool = getHbarBalanceTool({
      ...context,
      accountId: executor.accountId.toString(),
    });
    const res: any = await tool.execute(executorClient, context, params);

    expect(res.humanMessage).toContain('Failed to get HBAR balance');
  });
});
