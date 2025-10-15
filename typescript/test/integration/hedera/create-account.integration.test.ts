import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key, PrivateKey, Status } from '@hashgraph/sdk';
import createAccountTool from '@/plugins/core-account-plugin/tools/account/create-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';

describe('Create Account Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 2,
        key: executorAccountKey.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        await executorWrapper.deleteAccount({
          accountId: executorClient.operatorAccountId!,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      } catch (error) {
        console.warn('Failed to clean up executor account:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
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
        initialBalance: 0.05,
        accountMemo: 'Integration test account',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.raw.status).toBe(Status.Success.toString());
      const newAccountId = result.raw.accountId!.toString();

      const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8);

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
