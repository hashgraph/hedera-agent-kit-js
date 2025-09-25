import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import dissociateTokenTool from '@/plugins/core-token-plugin/tools/dissociate-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { dissociateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

describe('Dissociate Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let tokenCreatorClient: Client;

  let tokenCreatorAccountId: AccountId;
  let executorAccountId: AccountId;

  let executorWrapper: HederaOperationsWrapper;
  let tokenCreatorWrapper: HederaOperationsWrapper;

  let tokenIdFT: TokenId;
  let tokenIdNFT: TokenId;

  let context: Context;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Token creator account
    const tokenCreatorKey = PrivateKey.generateED25519();
    tokenCreatorAccountId = await operatorWrapper
      .createAccount({ key: tokenCreatorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);
    tokenCreatorClient = getCustomClient(tokenCreatorAccountId, tokenCreatorKey);
    tokenCreatorWrapper = new HederaOperationsWrapper(tokenCreatorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    // Deploy two fungible tokens using a token creator account
    const FT_PARAMS = {
      tokenName: 'DissociateTokenFT',
      tokenSymbol: 'DISS',
      tokenMemo: 'FT-DISSOCIATE',
      initialSupply: 1000,
      decimals: 2,
      maxSupply: 5000,
      supplyType: TokenSupplyType.Finite,
    };

    const NFT_PARAMS = {
      tokenName: 'GoldNFT',
      tokenSymbol: 'GLD',
      tokenMemo: 'NFT-DISSOCIATE',
      decimals: 2,
      maxSupply: 5000,
      supplyType: TokenSupplyType.Finite,
    };

    tokenIdFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: tokenCreatorAccountId.toString(),
        adminKey: tokenCreatorClient.operatorPublicKey!,
        supplyKey: tokenCreatorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    tokenIdNFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...NFT_PARAMS,
        initialSupply: 0,
        treasuryAccountId: tokenCreatorAccountId.toString(),
        adminKey: tokenCreatorClient.operatorPublicKey!,
        supplyKey: tokenCreatorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);
  });

  afterAll(async () => {
    // Delete executor and token creator accounts
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        tokenCreatorWrapper,
        tokenCreatorAccountId,
        operatorClient.operatorAccountId!,
      );

      executorClient.close();
      tokenCreatorClient.close();
      operatorClient.close();
    }
  });

  const associateTokens = async (tokenIds: TokenId[]) => {
    for (const tokenId of tokenIds) {
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenId.toString(),
      });
    }
  };

  it('should dissociate a single token successfully', async () => {
    await associateTokens([tokenIdFT]);

    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString()],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('successfully dissociated');

    const balances = await executorWrapper.getAccountTokenBalances(executorAccountId.toString());
    expect(balances.find(b => b.tokenId === tokenIdFT.toString())).toBeFalsy();
  });

  it('should dissociate multiple tokens at once - one is FT, one NFT', async () => {
    await associateTokens([tokenIdFT, tokenIdNFT]);

    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString(), tokenIdNFT.toString()],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('successfully dissociated');

    const balances = await executorWrapper.getAccountTokenBalances(executorAccountId.toString());
    expect(balances.find(b => b.tokenId === tokenIdFT.toString())).toBeFalsy();
    expect(balances.find(b => b.tokenId === tokenIdNFT.toString())).toBeFalsy();
  });

  it('should fail dissociating a token not associated', async () => {
    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString()],
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to dissociate');
    expect(result.raw.status).not.toBe('SUCCESS');
  });

  it('should fail dissociating a non-existent token', async () => {
    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: ['0.0.9999999'],
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to dissociate');
    expect(result.raw.status).not.toBe('SUCCESS');
  });
});
