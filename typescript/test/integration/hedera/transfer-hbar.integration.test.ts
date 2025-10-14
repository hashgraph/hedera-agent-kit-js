import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { Context, AgentMode } from '@/shared/configuration';
import {
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  verifyHbarBalanceChange,
} from '../../utils';
import { z } from 'zod';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';

describe('Transfer HBAR Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let recipientAccountId: AccountId;
  let recipientAccountId2: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 5, // To cover transfers and account creations
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    recipientAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    recipientAccountId2 = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      // Transfer remaining balance back to operator and delete an executor account
      try {
        await executorWrapper.deleteAccount({
          accountId: recipientAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });
        await executorWrapper.deleteAccount({
          accountId: recipientAccountId2,
          transferAccountId: operatorClient.operatorAccountId!,
        });
        await executorWrapper.deleteAccount({
          accountId: executorClient.operatorAccountId!,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      } catch (error) {
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  describe('Valid Transfer Scenarios', () => {
    it('should successfully transfer HBAR to a single recipient', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );
      const amountToTransfer = 0.1; // 0.1 HBAR

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: amountToTransfer,
          },
        ],
        transactionMemo: 'Integration test transfer',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Check that the result contains a transaction ID
      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change using the helper function
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should successfully transfer HBAR to multiple recipients', async () => {
      const balanceBefore1 = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );
      const balanceBefore2 = await executorWrapper.getAccountHbarBalance(
        recipientAccountId2.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 0.05,
          },
          {
            accountId: recipientAccountId2.toString(),
            amount: 0.05,
          },
        ],
        transactionMemo: 'Multi-recipient test transfer',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance changes for both recipients
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore1,
        0.05,
        executorWrapper,
      );
      await verifyHbarBalanceChange(
        recipientAccountId2.toString(),
        balanceBefore2,
        0.05,
        executorWrapper,
      );
    });

    it('should successfully transfer with explicit source account', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 0.1,
          },
        ],
        sourceAccountId: executorClient.operatorAccountId!.toString(),
        transactionMemo: 'Explicit source account test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        0.1,
        executorWrapper,
      );
    });

    it('should successfully transfer without memo', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 0.05,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        0.05,
        executorWrapper,
      );
    });

    it('should successfully create a scheduled transaction of transfer HBAR', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 0.05,
          },
        ],
        schedulingParams: {
          isScheduled: true,
          waitForExpiry: false,
          adminKey: false,
        },
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled HBAR transfer created successfully.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.humanMessage).toContain('Schedule ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Transfer Scenarios', () => {
    it('should fail with zero amount transfer', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 0,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Invalid transfer amount');
    });

    it('should fail with negative amount transfer', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: -0.1,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS'); // no success code
      expect(result.humanMessage).toContain('Invalid transfer amount');
    });

    it('should fail with invalid recipient account ID', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: 'invalid.account.id',
            amount: 0.1,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS'); // no success code
      expect(result.humanMessage).not.toContain('HBAR successfully transferred');
    });

    it('should fail with insufficient balance (large amount)', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: 1000000, // 1 million HBAR - likely more than test account has
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS'); //no success code
      expect(result.humanMessage).not.toContain('HBAR successfully transferred');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts (1 tinybar equivalent)', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );
      const amountToTransfer = 0.00000001; // 1 tinybar

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: amountToTransfer,
          },
        ],
        transactionMemo: 'Minimal amount test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should handle long memo strings', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );
      const longMemo = 'A'.repeat(90); // Close to 100 char limit for memos
      const amountToTransfer = 0.01;

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId.toString(),
            amount: amountToTransfer,
          },
        ],
        transactionMemo: longMemo,
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should handle maximum number of transfers in a single transaction', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );
      const transferAmount = 0.001;
      const transferCount = 10;
      const totalAmount = transferAmount * transferCount;

      // Create multiple small transfers
      const transfers = Array(transferCount)
        .fill(null)
        .map((_, _index) => ({
          accountId: recipientAccountId.toString(),
          amount: transferAmount,
        }));

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers,
        transactionMemo: 'Multiple transfers test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify total balance change
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        balanceBefore,
        totalAmount,
        executorWrapper,
      );
    });
  });
});
