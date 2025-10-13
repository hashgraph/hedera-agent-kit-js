import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import scheduleDeleteTool from '@/plugins/core-account-plugin/tools/account/schedule-delete';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import {
  scheduleDeleteTransactionParameters,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Schedule Delete Integration Tests', () => {
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
        initialBalance: 5,
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

  describe('Valid Schedule Delete Scenarios', () => {
    it('should successfully delete a scheduled transaction before execution', async () => {
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
          adminKey: operatorClient.operatorPublicKey as PublicKey,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();

      const params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>> = {
        scheduleId,
      };

      const tool = scheduleDeleteTool(context);
      const result = await tool.execute(operatorClient, context, params);

      expect(result.humanMessage).toContain('successfully deleted');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });
  });

  describe('Invalid Schedule Delete Scenarios', () => {
    it('should fail with invalid schedule ID', async () => {
      const params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>> = {
        scheduleId: '0.0.999999',
      };

      const tool = scheduleDeleteTool(context);
      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to delete scheduled transaction');
    });

    it('should fail with malformed schedule ID', async () => {
      const params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>> = {
        scheduleId: 'invalid-schedule-id',
      };

      const tool = scheduleDeleteTool(context);
      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to delete scheduled transaction');
    });
  });
});
