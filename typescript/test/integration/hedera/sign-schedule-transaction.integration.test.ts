import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import signScheduleTransactionTool from '@/plugins/core-account-plugin/tools/account/sign-schedule-transaction';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import {
  signScheduleTransactionParameters,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Sign Schedule Transaction Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let recipientAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 5, // To cover transfers and account creations
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    recipientAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      // Transfer remaining balance back to operator and delete an executor account
      try {
        await executorWrapper.deleteAccount({
          accountId: recipientAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });

        await executorWrapper.deleteAccount({
          accountId: executorClient.operatorAccountId!,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      } catch (error) {
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });
  describe('Valid Sign Schedule Transaction Scenarios', () => {
    it('should successfully sign a scheduled transaction', async () => {
      // First, create a scheduled transaction
      const transferAmount = 0.1;
      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipientAccountId,
            amount: transferAmount,
          },
          {
            accountId: executorClient.operatorAccountId!,
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
            accountId: recipientAccountId,
            amount: transferAmount,
          },
          {
            accountId: executorClient.operatorAccountId!,
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
            accountId: recipientAccountId,
            amount: transferAmount,
          },
          {
            accountId: executorClient.operatorAccountId!,
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
