import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import deleteAccountTool from '@/plugins/core-account-plugin/tools/account/delete-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import {
  deleteAccountParameters,
  createAccountParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Delete Account Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await hederaOperationsWrapper
      .createAccount({
        initialBalance: 5, // For creating and deleting accounts
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
      // Transfer remaining balance back to operator and delete an executor account
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

  const createTempAccount = async (): Promise<AccountId> => {
    const params: z.infer<ReturnType<typeof createAccountParametersNormalised>> = {
      key: executorClient.operatorPublicKey as Key,
      initialBalance: 1, // Give it some balance to be transferred upon deletion
    };
    const resp = await executorWrapper.createAccount(params);
    return resp.accountId!;
  };

  describe('Valid Delete Account Scenarios', () => {
    it('should delete an account and transfer remaining balance to executor by default', async () => {
      const accountId = await createTempAccount();

      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: accountId.toString(),
      };

      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Account successfully deleted.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBe('SUCCESS');

      // Verify the account is deleted by expecting failure on info fetch
      await expect(executorWrapper.getAccountInfo(accountId.toString())).rejects.toBeDefined();
    });

    it('should delete an account and transfer remaining balance to a specified account', async () => {
      const accountId = await createTempAccount();
      const transferTo = operatorClient.operatorAccountId!.toString();

      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: accountId.toString(),
        transferAccountId: transferTo,
      } as any;

      const result = await tool.execute(executorClient, context, params);
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.status).toBe('SUCCESS');

      await expect(executorWrapper.getAccountInfo(accountId.toString())).rejects.toBeDefined();
    });
  });

  describe('Invalid Delete Account Scenarios', () => {
    it('should fail when deleting a non-existent account', async () => {
      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: '0.0.999999999',
      };

      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toMatch(/INVALID_ACCOUNT_ID/i);
      expect(result.raw.error).toMatch(/INVALID_ACCOUNT_ID/i);
      expect(result.raw.status).not.toBe('SUCCESS');
    });
  });
});
