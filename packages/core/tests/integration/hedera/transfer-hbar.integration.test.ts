import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';

describe('Transfer HBAR Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient1: TestAccount;
  let recipient2: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    recipient1 = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipient2 = await profile.accounts.acquire({ tier: 'MINIMAL' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(recipient1);
    await profile.accounts.release(recipient2);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  describe('Valid Transfer Scenarios', () => {
    it('should successfully transfer HBAR to a single recipient', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );
      const amountToTransfer = 0.1; // 0.1 HBAR

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should successfully transfer HBAR to multiple recipients', async () => {
      const balanceBefore1 = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );
      const balanceBefore2 = await executorWrapper.getAccountHbarBalance(
        recipient2.accountId.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
            amount: 0.05,
          },
          {
            accountId: recipient2.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore1,
        0.05,
        executorWrapper,
      );
      await verifyHbarBalanceChange(
        recipient2.accountId.toString(),
        balanceBefore2,
        0.05,
        executorWrapper,
      );
    });

    it('should successfully transfer with explicit source account', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
            amount: 0.1,
          },
        ],
        sourceAccountId: executor.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        0.1,
        executorWrapper,
      );
    });

    it('should successfully transfer without memo', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        0.05,
        executorWrapper,
      );
    });

    it('should successfully create a scheduled transaction of transfer HBAR', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
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
            accountId: recipient1.accountId.toString(),
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
            accountId: recipient1.accountId.toString(),
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
            accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
      );
      const amountToTransfer = 0.00000001; // 1 tinybar

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should handle long memo strings', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );
      const longMemo = 'A'.repeat(90); // Close to 100 char limit for memos
      const amountToTransfer = 0.01;

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        amountToTransfer,
        executorWrapper,
      );
    });

    it('should handle maximum number of transfers in a single transaction', async () => {
      const balanceBefore = await executorWrapper.getAccountHbarBalance(
        recipient1.accountId.toString(),
      );
      const transferAmount = 0.001;
      const transferCount = 10;
      const totalAmount = transferAmount * transferCount;

      // Create multiple small transfers
      const transfers = Array(transferCount)
        .fill(null)
        .map((_, _index) => ({
          accountId: recipient1.accountId.toString(),
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
        recipient1.accountId.toString(),
        balanceBefore,
        totalAmount,
        executorWrapper,
      );
    });
  });
});
