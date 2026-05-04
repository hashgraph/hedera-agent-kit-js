import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
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
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';
import { parseHederaTimestamp, wait } from '@hashgraph/hedera-agent-kit-tests';

describe('Schedule Transaction Integration tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let updateAccount: TestAccount;
  let operatorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let updateAccountClient: Client;

  let context: Context;

  beforeAll(async () => {
    operatorWrapper = profile.client.connectAs(profile.operator).wrapper;
  });

  afterAll(async () => {
    // operator client is shared via profile.client; nothing to close here.
  });

  beforeEach(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    updateAccount = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: updateAccountClient } = profile.client.connectAs(updateAccount));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterEach(async () => {
    await profile.accounts.release(executor);
    await profile.accounts.release(updateAccount);
    executorClient?.close();
    updateAccountClient?.close();
  });

  it('should fail with invalid account id', async () => {
    const tool = updateAccountTool(context);
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: '0.0.999999999',
      accountMemo: 'x',
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: true,
        adminKey: executor.privateKey.publicKey.toStringRaw(),
      },
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).not.toBe('SUCCESS');
  });

  it('should successfully schedule an another account update', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
      accountMemo: 'updated via scheduled transaction',
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

    // the scheduled transaction should not have been executed yet
    const accountDetails = await operatorWrapper.getAccountInfo(updateAccount.accountId.toString());
    expect(accountDetails.accountMemo).not.toContain(params.accountMemo);

    await wait(MIRROR_NODE_WAITING_TIME);

    // the scheduled transaction details should match the input
    const scheduledTxDetails = await executorWrapper.getScheduledTransactionDetails(
      result.raw.scheduleId,
    );
    expect(scheduledTxDetails.admin_key?.key).toBe(executor.privateKey.publicKey.toStringRaw());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executor.accountId.toString(),
    );
    expect(scheduledTxDetails.executed_timestamp).toBe(null);
    expect(scheduledTxDetails.payer_account_id).toBe(executor.accountId.toString());
    expect(scheduledTxDetails.expiration_time).toBe(null);
    expect(scheduledTxDetails.deleted).toBe(false);
    expect(scheduledTxDetails.wait_for_expiry).toBe(false);
  });

  it('should schedule transaction with adminKey: true (using operator key)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
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
    expect(scheduledTxDetails.admin_key?.key).toBe(executor.privateKey.publicKey.toStringRaw());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executor.accountId.toString(),
    );
  });

  it('should schedule transaction with adminKey: false (no admin key)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
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
      executor.accountId.toString(),
    );
  });

  it('should schedule transaction with custom payerAccountId', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
      accountMemo: 'custom payer test',
      schedulingParams: {
        isScheduled: true,
        payerAccountId: profile.operator.accountId.toString(),
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
    expect(scheduledTxDetails.payer_account_id).toBe(profile.operator.accountId.toString());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executor.accountId.toString(),
    );
  });

  it('should schedule transaction with expirationTime', async () => {
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 30);
    const expirationTimeISO = futureTime.toISOString();

    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
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
      accountId: updateAccount.accountId.toString(),
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
      executor.accountId.toString(),
    );
  });

  it('should schedule transaction with minimal params (only isScheduled: true)', async () => {
    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
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
    expect(scheduledTxDetails.payer_account_id).toBe(executor.accountId.toString());
    expect(scheduledTxDetails.creator_account_id).toBe(
      executor.accountId.toString(),
    );
  });

  it('should schedule transaction with all parameters combined', async () => {
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 45);
    const expirationTimeISO = futureTime.toISOString();

    const params: z.infer<ReturnType<typeof updateAccountParameters>> = {
      accountId: updateAccount.accountId.toString(),
      accountMemo: 'all params combined test',
      maxAutomaticTokenAssociations: 10,
      schedulingParams: {
        isScheduled: true,
        adminKey: executor.privateKey.publicKey.toStringRaw(),
        payerAccountId: profile.operator.accountId.toString(),
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
    expect(scheduledTxDetails.admin_key?.key).toBe(executor.privateKey.publicKey.toStringRaw());
    expect(scheduledTxDetails.payer_account_id).toBe(profile.operator.accountId.toString());
    expect(scheduledTxDetails.wait_for_expiry).toBe(true);
    expect(scheduledTxDetails.expiration_time).toBeDefined();
    expect(scheduledTxDetails.creator_account_id).toBe(
      executor.accountId.toString(),
    );
    expect(scheduledTxDetails.executed_timestamp).toBeNull();

    // Verify expiration time
    const expectedExpiration = new Date(expirationTimeISO);
    const actualExpiration = parseHederaTimestamp(scheduledTxDetails.expiration_time!);
    const timeDiff = Math.abs(actualExpiration.getTime() - expectedExpiration.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });
});
