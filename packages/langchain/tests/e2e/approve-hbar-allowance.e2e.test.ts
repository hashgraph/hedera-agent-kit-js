import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  AccountId,
  Client,
  Hbar,
  HbarUnit,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
} from '@hashgraph/hedera-agent-kit-tests';
import {
  createLangchainTestSetup,
  LangchainTestSetup,
} from '@tests/utils/setup/langchain-test-setup';

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
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let executor: TestAccount; // acts as an owner for approval
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));
  });

  afterEach(async () => {
    await profile.accounts.release(spender);
    spenderClient?.close();
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

    const balanceBefore = await spenderWrapper.getAccountHbarBalance(spender.accountId.toString());

    // Ask the agent (running with an executor client) to approve allowance to the spender
    const input = `Approve ${allowanceAmount} HBAR allowance to ${spender.accountId.toString()} with memo "${memo}"`;
    await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    // Now, using a spender client, spend part of the approved allowance
    await spendViaAllowance(
      executor.accountId.toString(),
      spender.accountId.toString(),
      spendAmount,
    );

    await verifyHbarBalanceChange(
      spender.accountId.toString(),
      balanceBefore,
      spendAmount,
      spenderWrapper,
    );
  });

  it('should approve and spend very small amount via allowance', async () => {
    const allowanceAmount = 0.11;
    const spendAmount = 0.1;

    const balanceBefore = await spenderWrapper.getAccountHbarBalance(spender.accountId.toString());

    const input = `Approve ${allowanceAmount} HBAR allowance to ${spender.accountId.toString()}`;
    await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    await spendViaAllowance(
      executor.accountId.toString(),
      spender.accountId.toString(),
      spendAmount,
    );

    await verifyHbarBalanceChange(
      spender.accountId.toString(),
      balanceBefore,
      spendAmount,
      spenderWrapper,
    );
  });
});
