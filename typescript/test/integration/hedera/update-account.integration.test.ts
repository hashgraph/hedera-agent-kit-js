import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import updateAccountTool from '@/plugins/core-account-plugin/tools/account/update-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { updateAccountParameters } from '@/shared/parameter-schemas/account.zod';

describe('Update Account Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);
  });

  afterAll(async () => {
    if (operatorClient) {
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    const executorKeyPair = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKeyPair.publicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterEach(async () => {
    const customHederaOperationsWrapper = new HederaOperationsWrapper(executorClient);
    await customHederaOperationsWrapper.deleteAccount({
      accountId: executorClient.operatorAccountId!,
      transferAccountId: operatorClient.operatorAccountId!,
    });
    executorClient.close();
  });

  it('should update account memo and maxAutomaticTokenAssociations', async () => {
    const accountId = executorClient.operatorAccountId!.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      accountMemo: 'updated via integration test',
      maxAutomaticTokenAssociations: 4,
    } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Account successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await operatorWrapper.getAccountInfo(accountId);
    expect(info.accountMemo).toBe('updated via integration test');
    expect(info).toBeDefined();
    expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(4);
  });

  it('should update declineStakingReward flag', async () => {
    const accountId = executorClient.operatorAccountId!.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      declineStakingReward: true,
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).toBeDefined();

    const info = await operatorWrapper.getAccountInfo(accountId);
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
      accountId: executorAccountId!.toString(),
      accountMemo: 'updated via integration test',
      maxAutomaticTokenAssociations: 4,
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: executorClient.operatorPublicKey!.toStringRaw(),
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
