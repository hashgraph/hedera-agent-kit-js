import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Transaction } from '@hiero-ledger/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
} from '@hashgraph/hedera-agent-kit-tests';
import { TransactionStrategy, RawTransactionResponse, ExecuteStrategy } from '@/shared/strategies/tx-mode-strategy';
import { z } from 'zod';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';

describe('Custom Transaction Strategy Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));
    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('should successfully execute a transaction using a custom TransactionStrategy', async () => {
    let strategyCalled = false;

    // A custom strategy that wraps ExecuteStrategy and adds custom tracking
    class CustomTrackingStrategy implements TransactionStrategy {
      private defaultExecute = new ExecuteStrategy();

      async handle(
        tx: Transaction,
        client: Client,
        context: Context,
        postProcess?: (response: RawTransactionResponse) => string
      ) {
        strategyCalled = true;
        // Delegate to the standard execution strategy
        return this.defaultExecute.handle(tx, client, context, postProcess);
      }
    }

    const context: Context = {
      mode: AgentMode.CUSTOM,
      accountId: executor.accountId.toString(),
      transactionStrategy: new CustomTrackingStrategy(),
    };

    const balanceBefore = await executorWrapper.getAccountHbarBalance(
      recipient.accountId.toString(),
    );
    const amountToTransfer = 0.1;

    const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
      transfers: [
        {
          accountId: recipient.accountId.toString(),
          amount: amountToTransfer,
        },
      ],
      transactionMemo: 'Custom strategy integration test',
    };

    const tool = transferHbarTool(context);
    const result = await tool.execute(executorClient, context, params);

    // Assertions
    expect(strategyCalled).toBe(true);
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.humanMessage).toContain('HBAR successfully transferred');

    // Verify balance change
    await verifyHbarBalanceChange(
      recipient.accountId.toString(),
      balanceBefore,
      amountToTransfer,
      executorWrapper,
    );
  });
});
