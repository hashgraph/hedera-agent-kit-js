import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId, Key, PrivateKey } from '@hiero-ledger/sdk';
import getHbarBalanceTool from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import { AgentMode, type Context } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests';
import { BALANCE_TIERS } from '@hashgraph/hedera-agent-kit-tests';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests';

describe('Get HBAR Balance Integration Tests (Executor Account)', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorWrapper: HederaOperationsWrapper;
  let recipientAccountId: AccountId;

  beforeAll(async () => {
    // Create operator client & wrapper
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an intermediate executor account
    const executorKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Create a recipient account via executor
    recipientAccountId = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: UsdToHbarService.usdToHbar(0.1),
      })
      .then(resp => resp.accountId!);

    await wait(MIRROR_NODE_WAITING_TIME); // wait for mirror node indexing

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorWrapper && operatorClient) {
      // Delete a recipient account and transfer remaining balance back to executor
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        recipientAccountId,
        operatorClient.operatorAccountId!,
      );

      // Delete an executor account and transfer remaining balance back to operator
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );

      executorClient.close();
      operatorClient.close();
    }
  });

  it('should return balance for the recipient account', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: recipientAccountId.toString(),
    } as any;

    const tool = getHbarBalanceTool(context);
    const res: any = await tool.execute(executorClient, context, params);

    const expectedBalance = UsdToHbarService.usdToHbar(0.1);
    expect(res.raw.accountId).toBe(recipientAccountId.toString());
    expect(Number(res.raw.hbarBalance)).toBe(expectedBalance);
    expect(res.humanMessage).toContain(`Account ${recipientAccountId.toString()} has a balance of`);
  });

  it('should use default executor account when accountId not provided', async () => {
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {} as any;
    const executorBalance = await executorWrapper.getAccountHbarBalance(
      executorClient.operatorAccountId!.toString(),
    );

    const tool = getHbarBalanceTool({
      ...context,
      accountId: executorClient.operatorAccountId!.toString(),
    });
    const res: any = await tool.execute(executorClient, context, params);

    expect(res.raw.accountId).toBe(executorClient.operatorAccountId!.toString());
    expect(Number(res.raw.hbarBalance)).toBe(toDisplayUnit(executorBalance, 8).toNumber());
  });

  it('should handle not finding a non-existent account', async () => {
    const nonExistentAccountId = '0.0.999999999999';
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: nonExistentAccountId,
    } as any;

    const tool = getHbarBalanceTool({
      ...context,
      accountId: executorClient.operatorAccountId!.toString(),
    });
    const res: any = await tool.execute(executorClient, context, params);

    expect(res.humanMessage).toContain('Failed to get HBAR balance');
  });
});
