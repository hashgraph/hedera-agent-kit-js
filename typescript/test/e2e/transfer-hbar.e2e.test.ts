import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
  verifyHbarBalanceChange,
} from '../utils';

describe('Transfer HBAR E2E Tests with Intermediate Execution Account', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let recipientAccount: AccountId;

  // The operator account (from env variables) funds the setup process.
  // 1. An executor account is created using the operator account as the source of HBARs.
  // 2. The executor account is used to perform all Hedera operations required for the tests.
  // 3. LangChain is configured to run with the executor account as its client.
  // 4. After all tests are complete, the executor account is deleted and its remaining balance
  //    is transferred back to the operator account.
  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    recipientAccount = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);
  });

  afterEach(async () => {
    await executorWrapper.deleteAccount({
      accountId: recipientAccount,
      transferAccountId: executorClient.operatorAccountId!,
    });
  });

  it('should transfer HBAR to a recipient', async () => {
    const balanceBefore = await executorWrapper.getAccountHbarBalance(recipientAccount.toString());
    const amountToTransfer = 0.1;
    const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccount.toString()}`;

    await agentExecutor.invoke({ input });

    await verifyHbarBalanceChange(
      recipientAccount.toString(),
      balanceBefore,
      amountToTransfer,
      executorWrapper,
    );
    const balanceAfter = await executorWrapper.getAccountHbarBalance(recipientAccount.toString());
    expect(balanceAfter.toNumber()).toBeGreaterThan(balanceBefore.toNumber());
  });

  it('should transfer HBAR with memo', async () => {
    const balanceBefore = await executorWrapper.getAccountHbarBalance(recipientAccount.toString());
    const amountToTransfer = 0.05;
    const memo = 'Test memo for transfer';

    const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccount.toString()} with memo "${memo}"`;

    await agentExecutor.invoke({ input });

    await verifyHbarBalanceChange(
      recipientAccount.toString(),
      balanceBefore,
      amountToTransfer,
      executorWrapper,
    );
  });

  it('should handle very small amount (1 tinybar)', async () => {
    const balanceBefore = await executorWrapper.getAccountHbarBalance(recipientAccount.toString());
    const amountToTransfer = 0.00000001;

    const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccount.toString()}`;

    await agentExecutor.invoke({ input });

    await verifyHbarBalanceChange(
      recipientAccount.toString(),
      balanceBefore,
      amountToTransfer,
      executorWrapper,
    );
  });

  it('should handle long memo strings', async () => {
    const balanceBefore = await executorWrapper.getAccountHbarBalance(recipientAccount.toString());
    const longMemo = 'A'.repeat(90);
    const amountToTransfer = 0.01;

    const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccount.toString()} with memo "${longMemo}"`;

    await agentExecutor.invoke({ input });

    await verifyHbarBalanceChange(
      recipientAccount.toString(),
      balanceBefore,
      amountToTransfer,
      executorWrapper,
    );
  });
});
