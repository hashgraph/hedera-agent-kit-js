import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  AccountId,
  Client,
  Hbar,
  HbarUnit,
  Key,
  PrivateKey,
  TransferTransaction,
} from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
  verifyHbarBalanceChange,
} from '../utils';

/**
 * E2E tests for Approve HBAR Allowance using the LangChain agent, similar to transfer-hbar E2E tests.
 *
 * Flow:
 * 1. Operator (from env) funds creation of an executor (owner) account used by the agent.
 * 2. For each test, create a spender account with its own key and client.
 * 3. Ask the agent (running as executor) to approve an HBAR allowance for the spender.
 * 4. Spend a portion of the approved allowance from the spender account using an approved HBAR transfer.
 * 5. Verify spender balance increases by the spent amount.
 */

describe('Approve HBAR Allowance E2E Tests with Intermediate Execution Account', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client; // acts as an owner for approval
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  let spenderAccount: AccountId;
  let spenderKey: PrivateKey;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation (owner)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 15 })
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
    // Create a spender account with its own key so it can sign the allowance spent
    spenderKey = PrivateKey.generateED25519();
    spenderAccount = await executorWrapper
      .createAccount({
        key: spenderKey.publicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    spenderClient = getCustomClient(spenderAccount, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);
  });

  afterEach(async () => {
    // Clean up spender account, transferring remaining balance back to the executor (owner)
    await spenderWrapper.deleteAccount({
      accountId: spenderAccount,
      transferAccountId: executorClient.operatorAccountId!,
    });
  });

  const spendViaAllowance = async (ownerId: string, spenderId: string, amountHbar: number) => {
    // Spend from allowance: spender initiates an approved HBAR transfer from the owner to themselves
    const tinybars = Hbar.from(amountHbar, HbarUnit.Hbar).toTinybars();
    const tx = new TransferTransaction()
      // Negative amount from an owner (approved)
      .addApprovedHbarTransfer(AccountId.fromString(ownerId), Hbar.fromTinybars(tinybars.negate()))
      // Positive amount to spender
      .addHbarTransfer(AccountId.fromString(spenderId), Hbar.fromTinybars(tinybars));

    const resp = await tx.execute(spenderClient);
    await resp.getReceipt(spenderClient);
  };

  it('should approve HBAR allowance and allow spender to use part of it (with memo)', async () => {
    const allowanceAmount = 1.5; // approve 1.5 HBAR
    const spendAmount = 1.01; // spend 1.01 HBAR out of the allowance
    const memo = 'E2E approve allowance memo';

    const balanceBefore = await spenderWrapper.getAccountHbarBalance(spenderAccount.toString());

    // Ask the agent (running with an executor client) to approve allowance to the spender
    const input = `Approve ${allowanceAmount} HBAR allowance to ${spenderAccount.toString()} with memo "${memo}"`;
    await agentExecutor.invoke({ input });

    // Now, using a spender client, spend part of the approved allowance
    await spendViaAllowance(
      executorClient.operatorAccountId!.toString(),
      spenderAccount.toString(),
      spendAmount,
    );

    await verifyHbarBalanceChange(
      spenderAccount.toString(),
      balanceBefore,
      spendAmount,
      spenderWrapper,
    );
  });

  it('should approve and spend very small amount via allowance', async () => {
    const allowanceAmount = 0.11;
    const spendAmount = 0.1;

    const balanceBefore = await spenderWrapper.getAccountHbarBalance(spenderAccount.toString());

    const input = `Approve ${allowanceAmount} HBAR allowance to ${spenderAccount.toString()}`;
    await agentExecutor.invoke({ input });

    await spendViaAllowance(
      executorClient.operatorAccountId!.toString(),
      spenderAccount.toString(),
      spendAmount,
    );

    await verifyHbarBalanceChange(
      spenderAccount.toString(),
      balanceBefore,
      spendAmount,
      spenderWrapper,
    );
  });
});
