import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Hbar, HbarAllowance, HbarUnit, Key, PrivateKey } from '@hashgraph/sdk';
import transferHbarWithAllowanceTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar-with-allowance';
import { Context, AgentMode } from '@/shared/configuration';
import {
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  verifyHbarBalanceChange,
} from '../../utils';

describe('Transfer HBAR With Allowance Integration Tests', () => {
  let operatorClient: Client;
  let ownerClient: Client;
  let spenderClient: Client;
  let context: Context;
  let recipientAccountId: AccountId;
  let ownerWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let spenderAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    ownerWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an owner account
    const ownerKeyPair = PrivateKey.generateED25519();
    ownerAccountId = await ownerWrapper
      .createAccount({
        initialBalance: 30,
        key: ownerKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKeyPair);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a spender account
    const spenderKeyPair = PrivateKey.generateED25519();
    spenderAccountId = await ownerWrapper
      .createAccount({
        initialBalance: 5,
        key: spenderKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccountId, spenderKeyPair);

    // Create recipient
    recipientAccountId = await ownerWrapper
      .createAccount({ key: ownerClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: spenderAccountId.toString(), // spender executes the transfer
    };
  });

  afterAll(async () => {
    try {
      if (recipientAccountId) {
        await ownerWrapper.deleteAccount({
          accountId: recipientAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      }
      if (spenderAccountId) {
        await ownerWrapper.deleteAccount({
          accountId: spenderAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      }
      if (ownerAccountId) {
        await ownerWrapper.deleteAccount({
          accountId: ownerAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      }
    } catch (err) {
      console.warn('Cleanup failed:', err);
    }
    ownerClient?.close();
    spenderClient?.close();
    operatorClient?.close();
  });

  describe('Valid Allowance Transfer Scenarios', () => {
    it('should transfer HBAR using allowance', async () => {
      // Execute transfer
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: ownerAccountId,
            spenderAccountId: spenderAccountId,
            amount: Hbar.from(3, HbarUnit.Hbar),
          }),
        ],
      });

      // Get balance before
      const recipientBalanceBefore = await ownerWrapper.getAccountHbarBalance(
        recipientAccountId.toString(),
      );

      const params = {
        sourceAccountId: ownerAccountId.toString(),
        transfers: [{ accountId: recipientAccountId.toString(), amount: 2 }],
        transactionMemo: 'Allowance transfer',
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred with allowance');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance changes correctly
      await verifyHbarBalanceChange(
        recipientAccountId.toString(),
        recipientBalanceBefore,
        2,
        ownerWrapper,
      );
    });

    it('should allow multiple recipients in one allowance transaction', async () => {
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: ownerAccountId,
            spenderAccountId: spenderAccountId,
            amount: Hbar.from(5, HbarUnit.Hbar),
          }),
        ],
      });

      const params = {
        sourceAccountId: ownerAccountId.toString(),
        transfers: [
          { accountId: recipientAccountId.toString(), amount: 1 },
          { accountId: operatorClient.operatorAccountId!.toString(), amount: 1 },
        ],
        transactionMemo: 'Multi-recipient allowance transfer',
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred with allowance');
      expect(result.raw.status).toBe('SUCCESS');
    });
  });

  describe('Invalid Allowance Transfer Scenarios', () => {
    it('should fail if no allowance approved', async () => {
      const params = {
        sourceAccountId: operatorClient.operatorAccountId!.toString(),
        transfers: [{ accountId: recipientAccountId.toString(), amount: 1 }],
      };
      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to transfer HBAR');
    });

    it('should fail when transfer exceeds approved allowance', async () => {
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: ownerAccountId,
            spenderAccountId: spenderAccountId,
            amount: Hbar.from(1, HbarUnit.Hbar),
          }),
        ],
      });

      const params = {
        sourceAccountId: ownerAccountId.toString(),
        transfers: [{ accountId: recipientAccountId.toString(), amount: 5 }],
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.raw.status).not.toBe('SUCCESS');
      expect(result.humanMessage).toContain('Failed to transfer HBAR');
    });

    it('should fail if amount is zero or negative', async () => {
      const invalids = [0, -1];
      for (const amt of invalids) {
        const params = {
          sourceAccountId: ownerAccountId.toString(),
          transfers: [{ accountId: recipientAccountId.toString(), amount: amt }],
        };
        const tool = transferHbarWithAllowanceTool(context);
        const result = await tool.execute(spenderClient, context, params);
        expect(result.raw.status).not.toBe('SUCCESS');
        expect(result.humanMessage).toContain('Invalid transfer amount');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimal valid transfer (tinybar)', async () => {
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: ownerAccountId,
            spenderAccountId: spenderAccountId,
            amount: Hbar.from(2, HbarUnit.Tinybar),
          }),
        ],
      });

      const params = {
        sourceAccountId: ownerAccountId.toString(),
        transfers: [{ accountId: recipientAccountId.toString(), amount: 0.00000001 }],
        transactionMemo: 'Tinybar allowance test',
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred with allowance');
      expect(result.raw.status).toBe('SUCCESS');
    });
  });
});
