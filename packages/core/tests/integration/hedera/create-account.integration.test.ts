import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key, Status } from '@hiero-ledger/sdk';
import createAccountTool from '@/plugins/core-account-plugin/tools/account/create-account';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';

describe('Create Account Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  describe('Valid Create Account Scenarios', () => {
    it('should create an account with executor public key by default', async () => {
      const params = {};

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.humanMessage).toContain('New Account ID:');
      expect(result.raw.status).toBe(Status.Success.toString());
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.accountId).toBeDefined();

      const info = await executorWrapper.getAccountInfo(result.raw.accountId!.toString());
      expect(info.accountId.toString()).toBe(result.raw.accountId!.toString());
    });

    it('should create an account with initial balance and memo', async () => {
      const params = {
        initialBalance: profile.balance.usdToHbar(0.1),
        accountMemo: 'Integration test account',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.raw.status).toBe(Status.Success.toString());
      const newAccountId = result.raw.accountId!.toString();

      const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeCloseTo(profile.balance.usdToHbar(0.1) * 1e8);

      const info = await executorWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe('Integration test account');
    });

    it('should create an account with explicit public key', async () => {
      const publicKey = executorClient.operatorPublicKey as Key;
      const params = {
        publicKey: publicKey.toString(),
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.raw.status).toBe(Status.Success.toString());
      expect(result.raw.accountId).toBeDefined();
    });

    it('should schedule a create account transaction with explicit public key', async () => {
      const publicKey = executorClient.operatorPublicKey as Key;
      const params = {
        publicKey: publicKey.toString(),
        schedulingParams: { isScheduled: true },
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.raw.status).toBe(Status.Success.toString());
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Create Account Scenarios', () => {
    it('should fail with invalid public key', async () => {
      const params = {
        publicKey: 'not-a-valid-public-key',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.raw.status).not.toBe(Status.Success.toString());
      expect(result.humanMessage).toContain('public key cannot be decoded');
    });

    it('should fail with negative initial balance', async () => {
      const params = {
        initialBalance: -1,
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.raw.status).not.toBe(Status.Success.toString());
      expect(result.humanMessage).toContain('INVALID_INITIAL_BALANCE');
    });
  });
});
