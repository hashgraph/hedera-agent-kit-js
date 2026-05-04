import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import deleteHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/delete-hbar-allowance';
import approveHbarAllowanceTool from '@/plugins/core-account-plugin/tools/account/approve-hbar-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import { getProfile, type TestAccount } from '@hashgraph/hedera-agent-kit-tests';
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

    // First, approve an allowance so we have something to delete
    const approveTool = approveHbarAllowanceTool(context);
    await approveTool.execute(executorClient, context, {
      ownerAccountId: executor.accountId.toString(),
      spenderAccountId: spender.accountId.toString(),
      amount: 1, // grant allowance before revoking
      transactionMemo: 'initial allowance for delete test',
    });
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('deletes allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof deleteHbarAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
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
      spenderAccountId: spender.accountId.toString(),
    };

    const tool = deleteHbarAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('HBAR allowance deleted successfully');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
