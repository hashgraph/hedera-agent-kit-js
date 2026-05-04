import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Client, AccountId } from '@hiero-ledger/sdk';
import getAccountQueryTool from '@/plugins/core-account-query-plugin/tools/queries/get-account-query';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { accountQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';

describe('Get Account Query Integration Tests', () => {
  const profile = getProfile();
  let customAccount: TestAccount;
  let customClient: Client;
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let createdAccountId: AccountId;

  beforeAll(async () => {
    ({ client, wrapper: hederaOperationsWrapper } = profile.client.connectAs(profile.operator));
  });

  beforeEach(async () => {
    // Acquire a fresh account for each test
    customAccount = await profile.accounts.acquire({ tier: 'MINIMAL' });
    createdAccountId = customAccount.accountId;

    await wait(MIRROR_NODE_WAITING_TIME);

    ({ client: customClient } = profile.client.connectAs(customAccount));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: customAccount.accountId.toString(),
    };
  });

  it('should return account info for a valid account', async () => {
    const tool = getAccountQueryTool(context);

    const params: z.infer<ReturnType<typeof accountQueryParameters>> = {
      accountId: createdAccountId.toString(),
    };

    const result: any = await tool.execute(client, context, params);

    expect(result).toBeDefined();
    expect(result.raw).toBeDefined();
    expect(result.raw.account.accountId).toBe(createdAccountId.toString());
    expect(result.raw.account.evmAddress).toBeDefined();
    expect(result.raw.account.accountPublicKey).toEqual(
      customAccount.privateKey.publicKey.toStringRaw(),
    );

    expect(result.humanMessage).toContain(`Details for ${createdAccountId.toString()}`);
    expect(result.humanMessage).toContain('Balance:');
    expect(result.humanMessage).toContain('Public Key:');
    expect(result.humanMessage).toContain('EVM address:');
  });

  it('should return error for non-existent account', async () => {
    const tool = getAccountQueryTool(context);

    const params: z.infer<ReturnType<typeof accountQueryParameters>> = {
      accountId: '0.0.999999999', // deliberately invalid
    };

    const result: any = await tool.execute(client, context, params);

    expect(result.humanMessage).toContain(`Failed to fetch account ${params.accountId}`);
  });

  it('should return account info for operator account itself', async () => {
    const tool = getAccountQueryTool(context);

    const operatorId = client.operatorAccountId!.toString();

    const params: z.infer<ReturnType<typeof accountQueryParameters>> = {
      accountId: operatorId,
    };

    const result: any = await tool.execute(client, context, params);

    expect(result.raw.account.accountId).toBe(operatorId);
    expect(result.raw.account.evmAddress).toBeDefined();
    expect(result.raw.account.accountPublicKey).toEqual(client.operatorPublicKey?.toStringRaw());
    expect(result.humanMessage).toContain(`Details for ${operatorId}`);
    expect(result.humanMessage).toContain('Balance:');
    expect(result.humanMessage).toContain('Public Key:');
    expect(result.humanMessage).toContain('EVM address:');
  });

  afterEach(async () => {
    await profile.accounts.release(customAccount);
    customClient?.close();
  });
});
