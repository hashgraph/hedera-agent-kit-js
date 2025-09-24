import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import approveHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/approve-hbar-allowance';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { approveHbarAllowanceParameters } from '@/shared/parameter-schemas/account.zod';

/**
 * Integration tests for Approve HBAR Allowance tool
 *
 * These mirror the structure used by the transfer-hbar integration tests. We verify that:
 * - Transactions succeed with SUCCESS status and include a transaction ID
 * - We can approve decimal amounts, including amounts below 1 HBAR
 * - The tool works when ownerAccountId is omitted (defaults to context operator)
 */

describe('Approve HBAR Allowance Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let spenderAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 5, // cover fees
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    spenderAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
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
        // best-effort cleanup in tests
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it('approves allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spenderAccountId.toString(),
      amount: 1.25,
      transactionMemo: 'Integration approve test',
    };

    const tool = approveHbarAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('HBAR allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('approves allowance with default owner (from context) and sub-1 HBAR amount', async () => {
    const params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>> = {
      spenderAccountId: spenderAccountId.toString(),
      amount: 0.00000001, // 1 tinybar
    };

    const tool = approveHbarAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('HBAR allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
