import { afterAll, beforeAll, describe, it } from 'vitest';
import { createLangchainTestSetup, LangchainTestSetup } from '../utils';
import { AgentExecutor } from 'langchain/agents';
import HederaOperationsWrapper from '../utils/hedera-onchain-operations/HederaOperationsWrapper';
import { Client, Key } from '@hashgraph/sdk';
import { verifyHbarBalanceChange } from '../utils/uitls';

describe('Transfer HBAR E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let recipientAccountId: string;
  let recipientAccountId2: string;
  let client: Client;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup(); // the LLM provider can be set here if needed
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    recipientAccountId = await hederaOperationsWrapper
      .createAccount({ key: client.operatorPublicKey as Key })
      .then(accountId => accountId.toString());

    recipientAccountId2 = await hederaOperationsWrapper
      .createAccount({ key: client.operatorPublicKey as Key })
      .then(accountId => accountId.toString());
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
  });

  describe('Tool Matching and Parameter Extraction', () => {
    it('should match transfer HBAR tool for simple transfer request', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const amountToTransfer = 0.1; // 0.1 HBAR
      const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccountId}`;

      await agentExecutor.invoke({ input });

      // Verify balance change using the helper function
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        amountToTransfer,
        hederaOperationsWrapper,
      );
    });

    it('should match transfer HBAR tool for multiple recipients request', async () => {
      const balanceBefore1 =
        await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const balanceBefore2 =
        await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId2);

      const input = `Transfer 0.05 HBAR to ${recipientAccountId} and 0.05 HBAR to ${recipientAccountId2} with memo "Multi-recipient e2e test"`;

      await agentExecutor.invoke({ input });

      // Verify balance changes for both recipients
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore1,
        0.05,
        hederaOperationsWrapper,
      );
      await verifyHbarBalanceChange(
        recipientAccountId2,
        balanceBefore2,
        0.05,
        hederaOperationsWrapper,
      );
    });

    it('should match transfer HBAR tool with explicit source account', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const operatorAccountId = client.operatorAccountId!.toString();

      const input = `Transfer 0.1 HBAR from ${operatorAccountId} to ${recipientAccountId} with memo "Explicit source e2e test"`;

      await agentExecutor.invoke({ input });

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        0.1,
        hederaOperationsWrapper,
      );
    });

    it('should match transfer HBAR tool without memo', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);

      const input = `Send 0.05 HBAR to ${recipientAccountId}`;

      await agentExecutor.invoke({ input });

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        0.05,
        hederaOperationsWrapper,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts (1 tinybar equivalent)', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const amountToTransfer = 0.00000001; // 1 tinybar

      const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccountId} with memo "Minimal amount e2e test"`;

      await agentExecutor.invoke({ input });

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        amountToTransfer,
        hederaOperationsWrapper,
      );
    });

    it('should handle long memo strings', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const longMemo = 'A'.repeat(90); // Close to 100 char limit for memos
      const amountToTransfer = 0.01;

      const input = `Transfer ${amountToTransfer} HBAR to ${recipientAccountId} with memo "${longMemo}"`;

      await agentExecutor.invoke({ input });

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        amountToTransfer,
        hederaOperationsWrapper,
      );
    });

    it('should handle multiple small transfers to same recipient', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const transferAmount = 0.001;
      const transferCount = 10;
      const totalAmount = transferAmount * transferCount;

      // Create a request for multiple small transfers
      const transferList = Array(transferCount)
        .fill(null)
        .map(() => `${transferAmount} HBAR to ${recipientAccountId}`)
        .join(' and ');

      const input = `Transfer ${transferList} with memo "Multiple transfers e2e test"`;

      await agentExecutor.invoke({ input });

      // Verify total balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        totalAmount,
        hederaOperationsWrapper,
      );
    });
  });
});
