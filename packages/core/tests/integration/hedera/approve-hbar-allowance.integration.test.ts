import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import approveHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/approve-hbar-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import { getProfile, type TestAccount } from '@hashgraph/hedera-agent-kit-tests';
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
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let executorClient: Client;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient } = profile.client.connectAs(executor));

    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('approves allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
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
      spenderAccountId: spender.accountId.toString(),
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
