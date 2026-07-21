import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Hbar, HbarAllowance, HbarUnit } from '@hiero-ledger/sdk';
import transferHbarWithAllowanceTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar-with-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  verifyHbarBalanceChange,
} from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer HBAR With Allowance Integration Tests', () => {
  const profile = getProfile();
  let owner: TestAccount;
  let spender: TestAccount;
  let recipient: TestAccount;
  let ownerClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let spenderClient: Client;
  let context: Context;

  beforeAll(async () => {
    owner = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient } = profile.client.connectAs(spender));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: spender.accountId.toString(), // spender executes the transfer
    };
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(recipient);
    await profile.accounts.release(owner);
    ownerClient?.close();
    spenderClient?.close();
  });

  describe('Valid Allowance Transfer Scenarios', () => {
    it('should transfer HBAR using allowance', async () => {
      // Execute transfer
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: owner.accountId,
            spenderAccountId: spender.accountId,
            amount: Hbar.from(3, HbarUnit.Hbar),
          }),
        ],
      });

      // Get balance before
      const recipientBalanceBefore = await ownerWrapper.getAccountHbarBalance(
        recipient.accountId.toString(),
      );

      const params = {
        sourceAccountId: owner.accountId.toString(),
        transfers: [{ accountId: recipient.accountId.toString(), amount: 2 }],
        transactionMemo: 'Allowance transfer',
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred with allowance');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // Verify balance changes correctly
      await verifyHbarBalanceChange(
        recipient.accountId.toString(),
        recipientBalanceBefore,
        2,
        ownerWrapper,
      );
    });

    it('should allow multiple recipients in one allowance transaction', async () => {
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: owner.accountId,
            spenderAccountId: spender.accountId,
            amount: Hbar.from(5, HbarUnit.Hbar),
          }),
        ],
      });

      const params = {
        sourceAccountId: owner.accountId.toString(),
        transfers: [
          { accountId: recipient.accountId.toString(), amount: 1 },
          { accountId: profile.operator.accountId.toString(), amount: 1 },
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
        sourceAccountId: profile.operator.accountId.toString(),
        transfers: [{ accountId: recipient.accountId.toString(), amount: 1 }],
      };
      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.errorCode).toBe('SPENDER_DOES_NOT_HAVE_ALLOWANCE');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.humanMessage).toContain('Failed to execute Transfer HBAR with allowance');
    });

    it('should fail when transfer exceeds approved allowance', async () => {
      await ownerWrapper.approveHbarAllowance({
        hbarApprovals: [
          new HbarAllowance({
            ownerAccountId: owner.accountId,
            spenderAccountId: spender.accountId,
            amount: Hbar.from(1, HbarUnit.Hbar),
          }),
        ],
      });

      const params = {
        sourceAccountId: owner.accountId.toString(),
        transfers: [{ accountId: recipient.accountId.toString(), amount: 5 }],
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.errorCode).toBe('AMOUNT_EXCEEDS_ALLOWANCE');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.humanMessage).toContain('Failed to execute Transfer HBAR with allowance');
    });

    it('should fail if amount is zero or negative', async () => {
      const invalids = [0, -1];
      for (const amt of invalids) {
        const params = {
          sourceAccountId: owner.accountId.toString(),
          transfers: [{ accountId: recipient.accountId.toString(), amount: amt }],
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
            ownerAccountId: owner.accountId,
            spenderAccountId: spender.accountId,
            amount: Hbar.from(2, HbarUnit.Tinybar),
          }),
        ],
      });

      const params = {
        sourceAccountId: owner.accountId.toString(),
        transfers: [{ accountId: recipient.accountId.toString(), amount: 0.00000001 }],
        transactionMemo: 'Tinybar allowance test',
      };

      const tool = transferHbarWithAllowanceTool(context);
      const result = await tool.execute(spenderClient, context, params);

      expect(result.humanMessage).toContain('HBAR successfully transferred with allowance');
      expect(result.raw.status).toBe('SUCCESS');
    });
  });
});
