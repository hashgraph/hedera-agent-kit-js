import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Transfer HBAR E2E Tests with Intermediate Execution Account', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let recipient: TestAccount;

  // The operator account (from env variables) funds the setup process.
  // 1. An executor account is created using the operator account as the source of HBARs.
  // 2. The executor account is used to perform all Hedera operations required for the tests.
  // 3. LangChain is configured to run with the executor account as its client.
  // 4. After all tests are complete, the executor account is deleted and its remaining balance
  //    is transferred back to the operator account.
  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
  });

  afterEach(async () => {
    await profile.accounts.release(recipient);
  });

  it(
    'should transfer HBAR to a recipient',
    itWithRetry(async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient.accountId.toString(),
      );
      const amountToTransfer = 0.1;
      const input = `Transfer ${amountToTransfer} HBAR to ${recipient.accountId.toString()}`;

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      await verifyHbarBalanceChange(
        recipient.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
      const balanceAfter = await executorWrapper.getAccountHbarBalance(recipient.accountId.toString());
      expect(balanceAfter.toNumber()).toBeGreaterThan(balanceBefore.toNumber());
    }),
  );

  it(
    'should transfer HBAR with memo',
    itWithRetry(async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient.accountId.toString(),
      );
      const amountToTransfer = 0.05;
      const memo = 'Test memo for transfer';

      const input = `Transfer ${amountToTransfer} HBAR to ${recipient.accountId.toString()} with memo "${memo}"`;

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      await verifyHbarBalanceChange(
        recipient.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    }),
  );

  it(
    'should handle very small amount (1 tinybar)',
    itWithRetry(async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient.accountId.toString(),
      );
      const amountToTransfer = 0.00000001;

      const input = `Transfer ${amountToTransfer} HBAR to ${recipient.accountId.toString()}`;

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      await verifyHbarBalanceChange(
        recipient.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    }),
  );

  it(
    'should handle long memo strings',
    itWithRetry(async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient.accountId.toString(),
      );
      const longMemo = 'A'.repeat(90);
      const amountToTransfer = 0.01;

      const input = `Transfer ${amountToTransfer} HBAR to ${recipient.accountId.toString()} with memo "${longMemo}"`;

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      await verifyHbarBalanceChange(
        recipient.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    }),
  );

  it(
    'should schedule an HBAR transfer',
    itWithRetry(async () => {
      const amountToTransfer = 0.2;
      const input = `Transfer ${amountToTransfer} HBAR to ${recipient.accountId.toString()}. Schedule the transaction instead of executing it immediately.`;
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled HBAR transfer created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    }),
  );
});
