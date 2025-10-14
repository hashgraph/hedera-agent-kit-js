import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import updateAccountTool from '@/plugins/core-account-plugin/tools/account/update-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { updateAccountParameters } from '@/shared/parameter-schemas/account.zod';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { parseHederaTimestamp, wait } from '../../utils/general-util';

describe('Schedule Transaction Integration tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let updateAccountClient: Client;

  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let updateAccountWrapper: HederaOperationsWrapper;
  let executorAccountId: AccountId;
  let updateAccountId: AccountId;

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
    executorWrapper = new HederaOperationsWrapper(executorClient);

    const updateAccountKeyPair = PrivateKey.generateED25519();
    updateAccountId = await operatorWrapper
      .createAccount({
        key: updateAccountKeyPair.publicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);
    updateAccountClient = getCustomClient(updateAccountId, updateAccountKeyPair);
    updateAccountWrapper = new HederaOperationsWrapper(updateAccountClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterEach(async () => {
    await executorWrapper.deleteAccount({
      accountId: executorClient.operatorAccountId!,
      transferAccountId: operatorClient.operatorAccountId!,
    });

    await updateAccountWrapper.deleteAccount({
      accountId: updateAccountId,
      transferAccountId: operatorClient.operatorAccountId!,
    });
    executorClient.close();
    updateAccountClient.close();
  });

  it('should fail with invalid account id', async () => {
    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: '0.0.999999999',
      accountMemo: 'x',
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: true,
        adminKey: executorClient.operatorPublicKey!.toStringRaw(),
      },
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).not.toBe('SUCCESS');
  });

  it('should successfully schedule an another account update', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'updated via scheduled transaction',
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

    // the scheduled transaction should not have been executed yet
    const accountDetails = await operatorWrapper.getAccountInfo(updateAccountId.toString());
    expect(accountDetails.accountMemo).not.toContain(params.accountMemo);

    await wait(MIRROR_NODE_WAITING_TIME);

    // the scheduled transaction details should match the input
    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.admin_key?.key).toBe(executorClient.operatorPublicKey!.toStringRaw());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
    expect(scheduledTxDetails.executed_timestamp).toBe(null);
    expect(scheduledTxDetails.payer_account_id).toBe(executorClient.operatorAccountId!.toString());
    expect(scheduledTxDetails.expiration_time).toBe(null);
    expect(scheduledTxDetails.deleted).toBe(false);
    expect(scheduledTxDetails.wait_for_expiry).toBe(false);
  });

  it('should schedule transaction with adminKey: true (using operator key)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'admin key test - true',
      schedulingParams: {
        isScheduled: true,
        adminKey: true,
        waitForExpiry: false,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.admin_key?.key).toBe(executorClient.operatorPublicKey!.toStringRaw());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
  });

  it('should schedule transaction with adminKey: false (no admin key)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'admin key test - false',
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: false,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.admin_key).toBeNull();
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
  });

  it('should schedule transaction with custom payerAccountId', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'custom payer test',
      schedulingParams: {
        isScheduled: true,
        payerAccountId: operatorClient.operatorAccountId!.toString(),
        waitForExpiry: false,
        adminKey: false,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.payer_account_id).toBe(operatorClient.operatorAccountId!.toString());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
  });

  it('should schedule transaction with expirationTime', async () => {
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 30);
    const expirationTimeISO = futureTime.toISOString();

    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'expiration time test',
      schedulingParams: {
        isScheduled: true,
        expirationTime: expirationTimeISO,
        waitForExpiry: false,
        adminKey: true,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.expiration_time).toBeDefined();
    expect(scheduledTxDetails.expiration_time).not.toBeNull();

    // Verify the expiration time is approximately correct (within 5-minute tolerance)
    const expectedExpiration = new Date(expirationTimeISO);
    const actualExpiration = parseHederaTimestamp(scheduledTxDetails.expiration_time!);
    const timeDiff = Math.abs(actualExpiration.getTime() - expectedExpiration.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000); // 5 minutes in milliseconds
  });

  it('should schedule transaction with waitForExpiry: false', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'wait for expiry false test',
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: true,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.wait_for_expiry).toBe(false);
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
  });

  it('should schedule transaction with minimal params (only isScheduled: true)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'minimal scheduling params',
      schedulingParams: {
        waitForExpiry: false,
        isScheduled: true,
        adminKey: false,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );

    // Verify defaults are applied correctly
    expect(scheduledTxDetails.admin_key).toBeNull(); // adminKey defaults to false
    expect(scheduledTxDetails.wait_for_expiry).toBe(false); // waitForExpiry defaults to false
    expect(scheduledTxDetails.payer_account_id).toBe(executorClient.operatorAccountId!.toString());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
  });

  it('should schedule transaction with all parameters combined', async () => {
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 45);
    const expirationTimeISO = futureTime.toISOString();

    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccountId.toString(),
      accountMemo: 'all params combined test',
      maxAutomaticTokenAssociations: 10,
      schedulingParams: {
        isScheduled: true,
        adminKey: executorClient.operatorPublicKey!.toStringRaw(),
        payerAccountId: operatorClient.operatorAccountId!.toString(),
        expirationTime: expirationTimeISO,
        waitForExpiry: true,
      },
    };

    const tool = updateAccountTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();
    expect(result.humanMessage).toContain('Scheduled account update created successfully.');

    await wait(MIRROR_NODE_WAITING_TIME);

    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );

    // Verify all parameters are set correctly
    expect(scheduledTxDetails.admin_key?.key).toBe(executorClient.operatorPublicKey!.toStringRaw());
    expect(scheduledTxDetails.payer_account_id).toBe(operatorClient.operatorAccountId!.toString());
    expect(scheduledTxDetails.wait_for_expiry).toBe(true);
    expect(scheduledTxDetails.expiration_time).toBeDefined();
    expect(scheduledTxDetails.creator_account_id).toBe(
      executorClient.operatorAccountId!.toString(),
    );
    expect(scheduledTxDetails.executed_timestamp).toBeNull();

    // Verify expiration time
    const expectedExpiration = new Date(expirationTimeISO);
    const actualExpiration = parseHederaTimestamp(scheduledTxDetails.expiration_time!);
    const timeDiff = Math.abs(actualExpiration.getTime() - expectedExpiration.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });
});
