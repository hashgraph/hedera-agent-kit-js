import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Client, PrivateKey, Key, AccountId } from '@hashgraph/sdk';
import getAccountQueryTool from '@/plugins/core-account-query-plugin/tools/queries/get-account-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { accountQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Get Account Query Integration Tests', () => {
  let customClient: Client;
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let createdAccountId: AccountId;

  beforeAll(async () => {
    client = getOperatorClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(client);
  });

  beforeEach(async () => {
    // Create a fresh account for each test
    const privateKey = PrivateKey.generateED25519();
    createdAccountId = await hederaOperationsWrapper
      .createAccount({
        key: privateKey.publicKey as Key,
        initialBalance: 10,
      })
      .then(resp => resp.accountId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    customClient = getCustomClient(createdAccountId, privateKey);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: customClient.operatorAccountId!.toString(),
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
      customClient.operatorPublicKey?.toStringRaw(),
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
    // Cleanup: delete the temporary account
    const customHederaOps = new HederaOperationsWrapper(customClient);
    await customHederaOps.deleteAccount({
      accountId: customClient.operatorAccountId!,
      transferAccountId: client.operatorAccountId!,
    });
    customClient.close();
  });
});
