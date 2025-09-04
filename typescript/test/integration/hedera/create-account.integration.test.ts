import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key } from '@hashgraph/sdk';
import createAccountTool from '@/plugins/core-account-plugin/tools/account/create-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { createAccountParameters } from '@/shared/parameter-schemas/account.zod';

describe('Create Account Integration Tests', () => {
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: client.operatorAccountId!.toString(),
    };
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
  });

  describe('Valid Create Account Scenarios', () => {
    it('should create an account with operator public key by default', async () => {
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {};

      const tool = createAccountTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.humanMessage).toContain('New Account ID:');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.accountId).toBeDefined();

      // verify the account exists by fetching info
      const info = await hederaOperationsWrapper.getAccountInfo(result.raw.accountId!.toString());
      expect(info.accountId.toString()).toBe(result.raw.accountId!.toString());
    });

    it('should create an account with initial balance and memo', async () => {
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        initialBalance: 0.05,
        accountMemo: 'Integration test account',
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Account created successfully.');
      expect(result.raw.status).toBe('SUCCESS');
      const newAccountId = result.raw.accountId!.toString();

      const balance = await hederaOperationsWrapper.getAccountHbarBalance(newAccountId);
      // At least 0.05 HBAR in tinybars
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8);

      const info = await hederaOperationsWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe('Integration test account');
    });

    it('should create an account with explicit public key', async () => {
      const publicKey = client.operatorPublicKey as Key;
      const params: z.infer<ReturnType<typeof createAccountParameters>> = {
        publicKey: publicKey.toString(),
      };

      const tool = createAccountTool(context);
      const result = await tool.execute(client, context, params);

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
      const result = await tool.execute(client, context, params);

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
      const result = await tool.execute(client, context, params);

      if (typeof result === 'string') {
        expect(result).toContain('failed precheck with status INVALID_INITIAL_BALANCE');
      } else {
        expect(result.raw.status).not.toBe('SUCCESS');
      }
    });
  });
});
