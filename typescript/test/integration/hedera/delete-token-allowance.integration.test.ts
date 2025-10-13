import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey, TokenSupplyType } from '@hashgraph/sdk';
import deleteTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/delete-token-allowance';
import approveTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';
import { Context, AgentMode } from '@/shared/configuration';
import { z } from 'zod';
import { deleteTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Delete Token Allowance Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let spenderAccountId: AccountId;
  let tokenId: string;
  let executorWrapper: HederaOperationsWrapper;

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
    operatorClient = getOperatorClientForTests();

    // create executor account
    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await new HederaOperationsWrapper(operatorClient)
      .createAccount({
        initialBalance: 7,
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // create a spender account
    spenderAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    // create token
    tokenId = (
      await executorWrapper
        .createFungibleToken({
          ...FT_PARAMS,
          treasuryAccountId: executorAccountId.toString(),
          autoRenewAccountId: executorAccountId.toString(),
        })
        .then(resp => resp.tokenId!)
    ).toString();

    await wait(MIRROR_NODE_WAITING_TIME);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    // approve allowance first
    const approveTool = approveTokenAllowanceTool(context);
    await approveTool.execute(executorClient, context, {
      ownerAccountId: executorAccountId.toString(),
      spenderAccountId: spenderAccountId.toString(),
      tokenId,
      amount: 10,
    });
  });

  afterAll(async () => {
    if (executorClient) {
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it('deletes allowance with explicit owner', async () => {
    const params: z.infer<ReturnType<typeof deleteTokenAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spenderAccountId.toString(),
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
      spenderAccountId: spenderAccountId.toString(),
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
