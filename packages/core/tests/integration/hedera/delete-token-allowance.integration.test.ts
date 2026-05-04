import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TokenSupplyType } from '@hiero-ledger/sdk';
import deleteTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/delete-token-allowance';
import approveTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import { z } from 'zod';
import { deleteTokenAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';

describe('Delete Token Allowance Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let tokenId: string;

  const FT_PARAMS = {
    tokenName: 'DeletableToken',
    tokenSymbol: 'DEL',
    tokenMemo: 'FT',
    initialSupply: 100,
    decimals: 2,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });

    // create token
    tokenId = (
      await executorWrapper
        .createFungibleToken({
          ...FT_PARAMS,
          treasuryAccountId: executor.accountId.toString(),
          autoRenewAccountId: executor.accountId.toString(),
        })
        .then(resp => resp.tokenId!)
    ).toString();

    await wait(MIRROR_NODE_WAITING_TIME);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    // approve allowance first
    const approveTool = approveTokenAllowanceTool(context);
    await approveTool.execute(executorClient, context, {
      ownerAccountId: executor.accountId.toString(),
      spenderAccountId: spender.accountId.toString(),
      tokenId,
      amount: 10,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('deletes allowance with explicit owner', async () => {
    const params: z.infer<ReturnType<typeof deleteTokenAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
      tokenIds: [tokenId],
    };

    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = deleteTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token allowance(s) deleted successfully');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('deletes allowance with default owner (from context)', async () => {
    const params: z.infer<ReturnType<typeof deleteTokenAllowanceParameters>> = {
      spenderAccountId: spender.accountId.toString(),
      tokenIds: [tokenId],
    };

    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = deleteTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token allowance(s) deleted successfully');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
