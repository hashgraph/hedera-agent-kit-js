import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key } from '@hashgraph/sdk';
import deleteAccountTool from '@/plugins/core-account-plugin/tools/account/delete-account';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import {
  deleteAccountParameters,
  createAccountParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';

describe('Delete Account Integration Tests', () => {
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getOperatorClientForTests();
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

  const createTempAccount = async (): Promise<AccountId> => {
    const params: z.infer<ReturnType<typeof createAccountParametersNormalised>> = {
      key: client.operatorPublicKey as Key,
    };
    const resp = await hederaOperationsWrapper.createAccount(params);
    return resp.accountId!;
  };

  describe('Valid Delete Account Scenarios', () => {
    it('should delete an account and transfer remaining balance to operator by default', async () => {
      const accountId = await createTempAccount();

      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: accountId.toString(),
      } as any;

      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Account successfully deleted.');
      expect(result.humanMessage).toContain('Transaction ID:');
      expect(result.raw.status).toBeDefined();

      // Verify the account is deleted by expecting failure on info fetch
      await expect(
        hederaOperationsWrapper.getAccountInfo(accountId.toString()),
      ).rejects.toBeDefined();
    });

    it('should delete an account and transfer remaining balance to a specified account', async () => {
      const accountId = await createTempAccount();
      const transferTo = client.operatorAccountId!.toString();

      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: accountId.toString(),
        transferAccountId: transferTo,
      } as any;

      const result = await tool.execute(client, context, params);
      expect(result.raw.transactionId).toBeDefined();

      await expect(
        hederaOperationsWrapper.getAccountInfo(accountId.toString()),
      ).rejects.toBeDefined();
    });
  });

  describe('Invalid Delete Account Scenarios', () => {
    it('should fail when deleting a non-existent account', async () => {
      const tool = deleteAccountTool(context);
      const params: z.infer<ReturnType<typeof deleteAccountParameters>> = {
        accountId: '0.0.999999999',
      } as any;

      const result: any = await tool.execute(client, context, params);

      if (typeof result === 'string') {
        expect(result).toMatch(/INVALID_ACCOUNT_ID|ACCOUNT_DELETED|INVALID_SIGNATURE|NOT_FOUND/i);
      } else {
        expect(result.raw.status).not.toBe('SUCCESS');
      }
    });
  });
});
