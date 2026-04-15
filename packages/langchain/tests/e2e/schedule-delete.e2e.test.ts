import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { scheduleDeleteTool } from '@hashgraph/hedera-agent-kit/plugins';
import { Context, AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  getCustomClient,
  getOperatorClientForTests,
} from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { z } from 'zod';
import {
  scheduleDeleteTransactionParameters,
  transferHbarParametersNormalised,
} from '@hashgraph/hedera-agent-kit';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/utils';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';

describe('Schedule Delete E2E Tests', () => {
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
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
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
      accountId: operatorClient.operatorAccountId!.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          recipientAccountId,
          operatorClient.operatorAccountId!,
        );
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          executorClient.operatorAccountId!,
          operatorClient.operatorAccountId!,
        );
      } catch (error) {
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it(
    'deletes a scheduled transaction by admin',
    itWithRetry(async () => {
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
      expect(result.raw.status).toBe('SUCCESS');
    }),
  );
});
