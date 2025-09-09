import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { Client, Key, PrivateKey } from '@hashgraph/sdk';
import updateAccountTool from '@/plugins/core-account-plugin/tools/account/update-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { updateAccountParameters } from '@/shared/parameter-schemas/account.zod';

describe('Update Account Integration Tests', () => {
  let customClient: Client;
  let operatorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;

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
    const privateKey = PrivateKey.generateED25519();
    const accountId = await operatorWrapper
      .createAccount({
        key: privateKey.publicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    customClient = getCustomClient(accountId, privateKey);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: customClient.operatorAccountId!.toString(),
    };
  });

  afterEach(async () => {
    const customHederaOperationsWrapper = new HederaOperationsWrapper(customClient);
    await customHederaOperationsWrapper.deleteAccount({
      accountId: customClient.operatorAccountId!,
      transferAccountId: operatorClient.operatorAccountId!,
    });
    customClient.close();
  });

  it('should update account memo and maxAutomaticTokenAssociations', async () => {
    const accountId = customClient.operatorAccountId!.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      accountMemo: 'updated via integration test',
      maxAutomaticTokenAssociations: 4,
    } as any;

    const result: any = await tool.execute(customClient, context, params);

    expect(result.humanMessage).toContain('Account successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await operatorWrapper.getAccountInfo(accountId);
    expect(info.accountMemo).toBe('updated via integration test');
    expect(info).toBeDefined();
    expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(4);
  });

  it('should update declineStakingReward flag', async () => {
    const accountId = customClient.operatorAccountId!.toString();

    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId,
      declineStakingReward: true,
    } as any;

    const result: any = await tool.execute(customClient, context, params);
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

    const result: any = await tool.execute(customClient, context, params);

    if (typeof result === 'string') {
      expect(result).toMatch(/INVALID_ACCOUNT_ID|NOT_FOUND|ACCOUNT_DELETED/i);
    } else {
      expect(result.raw.status).not.toBe('SUCCESS');
    }
  });
});
