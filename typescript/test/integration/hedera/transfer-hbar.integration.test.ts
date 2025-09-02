import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId, Key } from '@hashgraph/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { Context, AgentMode } from '@/shared/configuration';
import { getClientForTests, HederaOperationsWrapper, verifyHbarBalanceChange } from '../../utils';
import { z } from 'zod';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';

describe.sequential('Transfer HBAR Integration Tests', () => {
  let client: Client;
  let context: Context;
  let operatorAccountId: AccountId;
  let recipientAccountId: string;
  let recipientAccountId2: string;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getClientForTests();
    operatorAccountId = client.operatorAccountId!;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    recipientAccountId = await hederaOperationsWrapper
      .createAccount({ key: client.operatorPublicKey as Key })
      .then(accountId => accountId.toString());

    recipientAccountId2 = await hederaOperationsWrapper
      .createAccount({ key: client.operatorPublicKey as Key })
      .then(accountId => accountId.toString());

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: operatorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
  });

  describe.sequential('Valid Transfer Scenarios', () => {
    it.sequential('should successfully transfer HBAR to a single recipient', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const amountToTransfer = 0.1; // 0.1 HBAR

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: amountToTransfer,
          },
        ],
        transactionMemo: 'Integration test transfer',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      // Check that the result contains a transaction ID
      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change using the helper function
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        amountToTransfer,
        hederaOperationsWrapper,
      );
    });

    it.sequential('should successfully transfer HBAR to multiple recipients', async () => {
      const balanceBefore1 =
        await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const balanceBefore2 =
        await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId2);

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: 0.05,
          },
          {
            accountId: recipientAccountId2,
            amount: 0.05,
          },
        ],
        transactionMemo: 'Multi-recipient test transfer',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

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

    it.sequential('should successfully transfer with explicit source account', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: 0.1,
          },
        ],
        sourceAccountId: operatorAccountId.toString(),
        transactionMemo: 'Explicit source account test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        0.1,
        hederaOperationsWrapper,
      );
    });

    it.sequential('should successfully transfer without memo', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: 0.05,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        0.05,
        hederaOperationsWrapper,
      );
    });
  });

  describe.sequential('Invalid Transfer Scenarios', () => {
    it('should fail with zero amount transfer', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: 0,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Invalid transfer amount');
    });

    it('should fail with negative amount transfer', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: -0.1,
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

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
      const result = await tool.execute(client, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS'); // no success code
      expect(result.humanMessage).not.toContain('HBAR successfully transferred');
    });

    it('should fail with insufficient balance (large amount)', async () => {
      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: 1000000, // 1 million HBAR - likely more than test account has
          },
        ],
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      // Should return an object with humanMessage and raw
      expect(result.raw.status).not.toBe('SUCCESS'); //no success code
      expect(result.humanMessage).not.toContain('HBAR successfully transferred');
    });
  });

  describe.sequential('Edge Cases', () => {
    it('should handle very small amounts (1 tinybar equivalent)', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const amountToTransfer = 0.00000001; // 1 tinybar

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: amountToTransfer,
          },
        ],
        transactionMemo: 'Minimal amount test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

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

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers: [
          {
            accountId: recipientAccountId,
            amount: amountToTransfer,
          },
        ],
        transactionMemo: longMemo,
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance change
      await verifyHbarBalanceChange(
        recipientAccountId,
        balanceBefore,
        amountToTransfer,
        hederaOperationsWrapper,
      );
    });

    it('should handle maximum number of transfers in a single transaction', async () => {
      const balanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(recipientAccountId);
      const transferAmount = 0.001;
      const transferCount = 10;
      const totalAmount = transferAmount * transferCount;

      // Create multiple small transfers
      const transfers = Array(transferCount)
        .fill(null)
        .map((_, _index) => ({
          accountId: recipientAccountId,
          amount: transferAmount,
        }));

      const params: z.infer<ReturnType<typeof transferHbarParameters>> = {
        transfers,
        transactionMemo: 'Multiple transfers test',
      };

      const tool = transferHbarTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

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
