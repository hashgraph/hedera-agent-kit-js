import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import getPendingAirdropTool from '@/plugins/core-token-query-plugin/tools/queries/get-pending-airdrop-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Get Pending Airdrop Query Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let recipientId: AccountId;

  const FT_PARAMS = {
    tokenName: 'AirdropQueryToken',
    tokenSymbol: 'ADQ',
    tokenMemo: 'FT-PENDING-QUERY',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 25 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorClient.operatorAccountId!.toString(),
    };

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    // Create recipient with 0 auto-associations to ensure airdrop is pending
    const recipientKey = PrivateKey.generateED25519();
    recipientId = await executorWrapper
      .createAccount({
        key: recipientKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations: 0,
      })
      .then(resp => resp.accountId!);

    // Airdrop tokens to recipient so they appear as pending
    await executorWrapper.airdropToken({
      tokenTransfers: [
        { tokenId: tokenIdFT.toString(), accountId: recipientId.toString(), amount: 100 },
        { tokenId: tokenIdFT.toString(), accountId: executorAccountId.toString(), amount: -100 },
      ],
    });

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  it('should return pending airdrops for a recipient account', async () => {
    const tool = getPendingAirdropTool(context);
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: recipientId.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain(
      `pending airdrops for account **${recipientId.toString()}**`,
    );
    expect(Array.isArray(result.raw.pendingAirdrops.airdrops)).toBe(true);
    expect(result.raw.pendingAirdrops.airdrops.length).toBeGreaterThan(0);
  });

  it('should fail gracefully for invalid account', async () => {
    const tool = getPendingAirdropTool(context);
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: '0.0.999999999',
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('No pending airdrops found for account');
  });
});
