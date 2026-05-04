import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import signScheduleTransactionTool from '@/plugins/core-account-plugin/tools/account/sign-schedule-transaction';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import {
  signScheduleTransactionParameters,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Sign Schedule Transaction Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient: TestAccount;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    operatorWrapper = profile.client.connectAs(profile.operator).wrapper;

    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    executorClient?.close();
  });
  describe('Valid Sign Schedule Transaction Scenarios', () => {
    it('should successfully sign a scheduled transaction', async () => {
      // First, create a scheduled transaction
      const transferAmount = 0.1;
      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipient.accountId,
            amount: transferAmount,
          },
          {
            accountId: executor.accountId,
            amount: -transferAmount,
          },
        ],
        schedulingParams: {
          isScheduled: true,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();

      // Now sign the scheduled transaction using the tool
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: scheduleId,
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Check that the result contains a success message
      expect(result.humanMessage).toContain('successfully signed');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should handle schedule ID with different formats', async () => {
      // Create a scheduled transaction
      const transferAmount = 0.05;
      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipient.accountId,
            amount: transferAmount,
          },
          {
            accountId: executor.accountId,
            amount: -transferAmount,
          },
        ],
        schedulingParams: {
          isScheduled: true,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();

      // Now sign the scheduled transaction using the tool
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: scheduleId,
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('successfully signed');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });
  });

  describe('Invalid Sign Schedule Transaction Scenarios', () => {
    it('should fail with invalid schedule ID', async () => {
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: '0.0.999999',
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an error
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to sign scheduled transaction');
    });

    it('should fail with malformed schedule ID', async () => {
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: 'invalid-schedule-id',
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an error
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to sign scheduled transaction');
    });

    it('should fail with empty schedule ID', async () => {
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: '',
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an error
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to sign scheduled transaction');
    });

    it('should fail when trying to sign already executed schedule', async () => {
      // Create a scheduled transaction
      const transferAmount = 0.01;

      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipient.accountId,
            amount: transferAmount,
          },
          {
            accountId: executor.accountId,
            amount: -transferAmount,
          },
        ],
        schedulingParams: {
          isScheduled: true,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();

      // Now sign the scheduled transaction using the tool
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: scheduleId,
      };

      const tool = signScheduleTransactionTool(context);
      const firstResult = await tool.execute(executorClient, context, params);

      expect(firstResult.humanMessage).toContain('successfully signed');

      // Try to sign it again - this should fail
      const secondResult = await tool.execute(executorClient, context, params);

      // Should return an error since the schedule is already executed
      expect(secondResult.raw.status).not.toBe('SUCCESS');
      expect(secondResult.humanMessage).toContain('Failed to sign scheduled transaction');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long schedule ID strings', async () => {
      const longScheduleId = '0.0.123456789012345678901234567890';
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: longScheduleId,
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an error since this is not a valid schedule ID
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to sign scheduled transaction');
    });

    it('should handle schedule ID with special characters', async () => {
      const specialScheduleId = '0.0.123@#$%';
      const params: z.infer<ReturnType<typeof signScheduleTransactionParameters>> = {
        scheduleId: specialScheduleId,
      };

      const tool = signScheduleTransactionTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an error since this is not a valid schedule ID
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to sign scheduled transaction');
    });
  });
});
