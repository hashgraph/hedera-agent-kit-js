import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key } from '@hiero-ledger/sdk';
import deleteAccountTool from '@/plugins/core-account-plugin/tools/account/delete-account';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import {
  deleteAccountParameters,
  createAccountParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Delete Account Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    hederaOperationsWrapper = profile.client.connectAs(profile.operator).wrapper;

    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
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

  const createTempAccount = async (): Promise<AccountId> => {
    const params: z.infer<ReturnType<typeof createAccountParametersNormalised>> = {
      key: executor.privateKey.publicKey as Key,
      initialBalance: profile.balance.fund('MINIMAL'),
    };
    // Operator creates the temp account to preserve executor balance
    const resp = await hederaOperationsWrapper.createAccount(params);
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
      const transferTo = profile.operator.accountId.toString();

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
