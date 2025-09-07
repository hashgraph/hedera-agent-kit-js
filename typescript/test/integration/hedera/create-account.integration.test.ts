import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key, PrivateKey } from '@hashgraph/sdk';
import createAccountTool from '@/plugins/core-account-plugin/tools/account/create-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { createAccountParameters } from '@/shared/parameter-schemas/account.zod';

describe('Create Account Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let executorOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKeyPair = PrivateKey.generateED25519(); // TODO: decide key type
    const executorAccountId = await hederaOperationsWrapper
      .createAccount({
        initialBalance: 2,
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorOperationsWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      // Transfer remaining balance back to operator and delete an executor account
      try {
        await executorOperationsWrapper.deleteAccount({
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
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {};

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.humanMessage).toContain('New Account ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.accountId).toBeDefined();

      // verify the account exists by fetching info
      const info = await executorOperationsWrapper.getAccountInfo(result.raw.accountId!.toString());
      expect(info.accountId.toString()).toBe(result.raw.accountId!.toString());
    });

    it('should create an account with initial balance and memo', async () => {
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        initialBalance: 0.05,
        accountMemo: 'Integration test account',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.raw.status).toBe('SUCCESS');
      const newAccountId = result.raw.accountId!.toString();

      const balance = await executorOperationsWrapper.getAccountHbarBalance(newAccountId);
      // At least 0.05 HBAR in tinybars
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8);

      const info = await executorOperationsWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe('Integration test account');
    });

    it('should create an account with explicit public key', async () => {
      const publicKey = executorClient.operatorPublicKey as Key;
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        publicKey: publicKey.toString(),
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.accountId).toBeDefined();
    });
  });

  describe('Invalid Create Account Scenarios', () => {
    it('should fail with invalid public key', async () => {
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        publicKey: 'not-a-valid-public-key',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      if (typeof result === 'string') {
        expect(result).toContain(
          'public key cannot be decoded from bytes: cannot decode ECDSA public key from this DER format',
        );
      } else {
        expect(result.raw.status).not.toBe('SUCCESS');
      }
    });

    it('should fail with negative initial balance', async () => {
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        initialBalance: -1,
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(executorClient, context, params);

      if (typeof result === 'string') {
        expect(result).toContain('failed precheck with status INVALID_INITIAL_BALANCE');
      } else {
        expect(result.raw.status).not.toBe('SUCCESS');
      }
    });
  });
});
