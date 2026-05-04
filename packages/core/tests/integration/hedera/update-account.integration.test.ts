import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import updateAccountTool from '@/plugins/core-account-plugin/tools/account/update-account';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { updateAccountParameters } from '@/shared/parameter-schemas/account.zod';

describe('Update Account Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeEach(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterEach(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('should update account memo and maxAutomaticTokenAssociations', async () => {
    const accountId = executor.accountId.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      accountMemo: 'updated via integration test',
      maxAutomaticTokenAssociations: 4,
    } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Account successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await executorWrapper.getAccountInfo(accountId);
    expect(info.accountMemo).toBe('updated via integration test');
    expect(info).toBeDefined();
    expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(4);
  });

  it('should update declineStakingReward flag', async () => {
    const accountId = executor.accountId.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      declineStakingReward: true,
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).toBeDefined();

    const info = await executorWrapper.getAccountInfo(accountId);
    expect(info).toBeDefined();
    expect(info.stakingInfo?.declineStakingReward).toBe(true);
  });

  it('should fail with invalid account id', async () => {
    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: '0.0.999999999',
      accountMemo: 'x',
    } as any;

    const result: any = await tool.execute(executorClient, context, params);

    if (typeof result === 'string') {
      expect(result).toMatch(/INVALID_ACCOUNT_ID|NOT_FOUND|ACCOUNT_DELETED/i);
    } else {
      expect(result.raw.status).not.toBe('SUCCESS');
    }
  });

  it('should successfully schedule an account update', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: executor.accountId.toString(),
      accountMemo: 'updated via integration test',
      maxAutomaticTokenAssociations: 4,
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: executor.privateKey.publicKey.toStringRaw(),
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Scheduled account update created successfully.');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.humanMessage).toContain('Schedule ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.raw.scheduleId).toBeDefined();
  });
});
