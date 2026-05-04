import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey } from '@hiero-ledger/sdk';
import { scheduleDeleteTool } from '@hashgraph/hedera-agent-kit/plugins';
import { Context, AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import {
  scheduleDeleteTransactionParameters,
  transferHbarParametersNormalised,
} from '@hashgraph/hedera-agent-kit';

describe('Schedule Delete E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let recipient: TestAccount;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: profile.operator.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it(
    'deletes a scheduled transaction by admin',
    itWithRetry(async () => {
      const transferAmount = 0.05;
      const operatorClient = profile.client.connectAs(profile.operator).client;
      const operatorWrapper = new HederaOperationsWrapper(operatorClient);

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
      expect(result.raw.status).toBe('SUCCESS');

      operatorClient.close();
    }),
  );
});
