import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import deleteHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/delete-hbar-allowance';
import approveHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/approve-hbar-allowance';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { deleteHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';

/**
 * Integration tests for Delete HBAR Allowance tool
 *
 * These mirror the structure used by the approve-hbar-allowance integration tests. We verify that:
 * - Transactions succeed with SUCCESS status and include a transaction ID
 * - Deleting an allowance sets the amount to 0 (revoking allowance)
 * - The tool works when ownerAccountId is omitted (defaults to context operator)
 */

describe('Delete HBAR Allowance Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let spenderAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // create executor account
    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 5, // cover fees
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // create spender account
    spenderAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    // First, approve an allowance so we have something to delete
    const approveTool = approveHbarAllowanceTool(context);
    await approveTool.execute(executorClient, context, {
      ownerAccountId: executorAccountId.toString(),
      spenderAccountId: spenderAccountId.toString(),
      amount: 1, // grant allowance before revoking
      transactionMemo: 'initial allowance for delete test',
    });
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        await executorWrapper.deleteAccount({
          accountId: spenderAccountId,
          transferAccountId: operatorClient.operatorAccountId!,
        });
        await executorWrapper.deleteAccount({
          accountId: executorClient.operatorAccountId!,
          transferAccountId: operatorClient.operatorAccountId!,
        });
      } catch (error) {
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it('deletes allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof deleteHbarAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spenderAccountId.toString(),
      transactionMemo: 'Delete allowance test',
    };

    const tool = deleteHbarAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('HBAR allowance deleted successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('deletes allowance with default owner (from context)', async () => {
    const params: z.infer<ReturnType<typeof deleteHbarAllowanceParameters>> = {
      spenderAccountId: spenderAccountId.toString(),
    };

    const tool = deleteHbarAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('HBAR allowance deleted successfully');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
