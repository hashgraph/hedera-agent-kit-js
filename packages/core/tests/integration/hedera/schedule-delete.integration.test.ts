import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey } from '@hiero-ledger/sdk';
import scheduleDeleteTool from '@/plugins/core-account-plugin/tools/account/schedule-delete';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import {
  scheduleDeleteTransactionParameters,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Schedule Delete Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient: TestAccount;
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let context: Context;

  beforeAll(async () => {
    ({ client: operatorClient, wrapper: operatorWrapper } = profile.client.connectAs(
      profile.operator,
    ));

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
    operatorClient?.close();
  });

  describe('Valid Schedule Delete Scenarios', () => {
    it('should successfully delete a scheduled transaction before execution', async () => {
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
          adminKey: profile.operator.privateKey.publicKey as PublicKey,
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

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.errorCode).toBe('INVALID_SCHEDULE_ID');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.humanMessage).toContain('Failed to execute Delete Scheduled Transaction');
    });

    it('should fail with malformed schedule ID', async () => {
      const params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>> = {
        scheduleId: 'invalid-schedule-id',
      };

      const tool = scheduleDeleteTool(context);
      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to execute Delete Scheduled Transaction');
    });
  });
});
