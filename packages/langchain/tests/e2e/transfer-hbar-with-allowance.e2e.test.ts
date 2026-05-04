import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, Hbar, HbarUnit, HbarAllowance } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer HBAR With Allowance E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;

  let owner: TestAccount;
  let ownerClient: Client;
  let ownerWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;

  let recipient: TestAccount;
  let recipient2: TestAccount;

  beforeAll(async () => {
    owner = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: spenderClient } = profile.client.connectAs(spender));

    // Create recipient
    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipient2 = await profile.accounts.acquire({ tier: 'MINIMAL' });

    // Set up LangChain executor with spender (who uses allowance)
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agent = testSetup.agent;

    // Approve HBAR allowance: owner → spender
    await ownerWrapper.approveHbarAllowance({
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId: owner.accountId,
          spenderAccountId: spender.accountId,
          amount: Hbar.from(5, HbarUnit.Hbar),
        }),
      ],
    });
  });

  afterAll(async () => {
    await profile.accounts.release(recipient2);
    await profile.accounts.release(recipient);
    await profile.accounts.release(spender);
    await profile.accounts.release(owner);
    testSetup?.cleanup();
    ownerClient?.close();
    spenderClient?.close();
  });

  beforeEach(async () => {
    // Reapprove if needed (allowance may be consumed between tests)
    await ownerWrapper.approveHbarAllowance({
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId: owner.accountId,
          spenderAccountId: spender.accountId,
          amount: Hbar.from(5, HbarUnit.Hbar),
        }),
      ],
    });
  });

  it(
    'should transfer HBAR using allowance',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipient.accountId.toString());
      const amountToTransfer = 0.2;

      const input = `Transfer ${amountToTransfer} HBAR from ${owner.accountId.toString()} to ${recipient.accountId.toString()} using allowance`;
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
        ownerWrapper,
      );
    }),
  );

  it(
    'should transfer HBAR with allowance and memo',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipient.accountId.toString());
      const amountToTransfer = 0.1;
      const memo = 'Allowance-based HBAR transfer test';

      const input = `Spend allowance from ${owner.accountId.toString()} to send ${amountToTransfer} HBAR to ${recipient.accountId.toString()} with memo "${memo}"`;
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
        ownerWrapper,
      );
    }),
  );

  it(
    'should handle small amounts via allowance (1 tinybar)',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipient.accountId.toString());
      const amountToTransfer = 0.00000001;

      const input = `Transfer ${amountToTransfer} HBAR from ${owner.accountId.toString()} to ${recipient.accountId.toString()} using allowance`;
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
        ownerWrapper,
      );
    }),
  );

  it(
    'should handle long memo with allowance',
    itWithRetry(async () => {
      const balanceBefore = await ownerWrapper.getAccountHbarBalance(recipient.accountId.toString());
      const longMemo = 'A'.repeat(90);
      const amountToTransfer = 0.05;

      const input = `Use allowance from ${owner.accountId.toString()} to send ${amountToTransfer} HBAR to ${recipient.accountId.toString()} with memo "${longMemo}"`;
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
        ownerWrapper,
      );
    }),
  );

  it(
    'should support multiple recipients with allowance',
    itWithRetry(async () => {
      const balanceBefore1 = await ownerWrapper.getAccountHbarBalance(recipient.accountId.toString());
      const balanceBefore2 = await ownerWrapper.getAccountHbarBalance(
        recipient2.accountId.toString(),
      );

      const input = `Use allowance from ${owner.accountId.toString()} to send 0.05 HBAR to ${recipient.accountId.toString()} and 0.05 HBAR to ${recipient2.accountId.toString()}`;
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
        balanceBefore1,
        0.05,
        ownerWrapper,
      );
      await verifyHbarBalanceChange(
        recipient2.accountId.toString(),
        balanceBefore2,
        0.05,
        ownerWrapper,
      );
    }),
  );
});
