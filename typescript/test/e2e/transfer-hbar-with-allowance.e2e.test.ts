import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey, Hbar, HbarUnit, HbarAllowance } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
  verifyHbarBalanceChange,
} from '../utils';
import { itWithRetry } from '../utils/retry-util';

describe('Transfer HBAR With Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let ownerClient: Client;
  let spenderClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let operatorWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let spenderAccountId: AccountId;
  let recipientAccount: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an owner account
    const ownerKey = PrivateKey.generateED25519();
    ownerAccountId = await operatorWrapper
      .createAccount({ key: ownerKey.publicKey, initialBalance: 10 })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a spender account
    const spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await operatorWrapper
      .createAccount({ key: spenderKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccountId, spenderKey);

    // Create recipient
    recipientAccount = await ownerWrapper
      .createAccount({
        key: ownerClient.operatorPublicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);

    // Set up LangChain executor with spender (who uses allowance)
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agentExecutor = testSetup.agentExecutor;

    // Approve HBAR allowance: owner → spender
    await ownerWrapper.approveHbarAllowance({
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId,
          spenderAccountId,
          amount: Hbar.from(5, HbarUnit.Hbar),
        }),
      ],
    });
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();

    // Cleanup created accounts
    try {
      await ownerWrapper.deleteAccount({
        accountId: recipientAccount,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      await ownerWrapper.deleteAccount({
        accountId: spenderAccountId,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      await ownerWrapper.deleteAccount({
        accountId: ownerAccountId,
        transferAccountId: operatorClient.operatorAccountId!,
      });
    } catch (err) {
      console.warn('Cleanup failed:', err);
    }

    operatorClient.close();
  });

  beforeEach(async () => {
    // Reapprove if needed (allowance may be consumed between tests)
    await ownerWrapper.approveHbarAllowance({
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId,
          spenderAccountId,
          amount: Hbar.from(5, HbarUnit.Hbar),
        }),
      ],
    });
  });

  it(
    'should transfer HBAR using allowance',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipientAccount.toString());
      const amountToTransfer = 0.2;

      const input = `Transfer ${amountToTransfer} HBAR from ${ownerAccountId.toString()} to ${recipientAccount.toString()} using allowance`;
      await agentExecutor.invoke({ input });

      await verifyHbarBalanceChange(
        recipientAccount.toString(),
        balanceBefore,
        amountToTransfer,
        ownerWrapper,
      );
    }),
  );

  it(
    'should transfer HBAR with allowance and memo',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipientAccount.toString());
      const amountToTransfer = 0.1;
      const memo = 'Allowance-based HBAR transfer test';

      const input = `Spend allowance from ${ownerAccountId.toString()} to send ${amountToTransfer} HBAR to ${recipientAccount.toString()} with memo "${memo}"`;
      await agentExecutor.invoke({ input });

      await verifyHbarBalanceChange(
        recipientAccount.toString(),
        balanceBefore,
        amountToTransfer,
        ownerWrapper,
      );
    }),
  );

  it(
    'should handle small amounts via allowance (1 tinybar)',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipientAccount.toString());
      const amountToTransfer = 0.00000001;

      const input = `Transfer ${amountToTransfer} HBAR from ${ownerAccountId.toString()} to ${recipientAccount.toString()} using allowance`;
      await agentExecutor.invoke({ input });

      await verifyHbarBalanceChange(
        recipientAccount.toString(),
        balanceBefore,
        amountToTransfer,
        ownerWrapper,
      );
    }),
  );

  it(
    'should handle long memo with allowance',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipientAccount.toString());
      const longMemo = 'A'.repeat(90);
      const amountToTransfer = 0.05;

      const input = `Use allowance from ${ownerAccountId.toString()} to send ${amountToTransfer} HBAR to ${recipientAccount.toString()} with memo "${longMemo}"`;
      await agentExecutor.invoke({ input });

      await verifyHbarBalanceChange(
        recipientAccount.toString(),
        balanceBefore,
        amountToTransfer,
        ownerWrapper,
      );
    }),
  );

  it(
    'should support multiple recipients with allowance',
    itWithRetry(async () => {
      const recipient2 = await ownerWrapper
        .createAccount({
          key: ownerClient.operatorPublicKey as Key,
          initialBalance: 0,
        })
        .then(resp => resp.accountId!);

      const balanceBefore1 = await ownerWrapper.getAccountHbarBalance(recipientAccount.toString());
      const balanceBefore2 = await ownerWrapper.getAccountHbarBalance(recipient2.toString());

      const input = `Use allowance from ${ownerAccountId.toString()} to send 0.05 HBAR to ${recipientAccount.toString()} and 0.05 HBAR to ${recipient2.toString()}`;
      await agentExecutor.invoke({ input });

      await verifyHbarBalanceChange(
        recipientAccount.toString(),
        balanceBefore1,
        0.05,
        ownerWrapper,
      );
      await verifyHbarBalanceChange(recipient2.toString(), balanceBefore2, 0.05, ownerWrapper);

      // Cleanup recipient2
      await ownerWrapper.deleteAccount({
        accountId: recipient2,
        transferAccountId: ownerAccountId,
      });
    }),
  );
});
