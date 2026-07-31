import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import dissociateTokenTool from '@/plugins/core-token-plugin/tools/dissociate-token';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { dissociateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Dissociate Token Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let tokenCreator: TestAccount;
  let executorClient: Client;
  let tokenCreatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenCreatorWrapper: HederaOperationsWrapper;

  let tokenIdFT: TokenId;
  let tokenIdNFT: TokenId;

  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    tokenCreator = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: tokenCreatorClient, wrapper: tokenCreatorWrapper } =
      profile.client.connectAs(tokenCreator));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
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
        treasuryAccountId: tokenCreator.accountId.toString(),
        adminKey: tokenCreator.privateKey.publicKey,
        supplyKey: tokenCreator.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    tokenIdNFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...NFT_PARAMS,
        initialSupply: 0,
        treasuryAccountId: tokenCreator.accountId.toString(),
        adminKey: tokenCreator.privateKey.publicKey,
        supplyKey: tokenCreator.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);
  });

  afterAll(async () => {
    await profile.accounts.release(tokenCreator);
    await profile.accounts.release(executor);
    executorClient?.close();
    tokenCreatorClient?.close();
  });

  const associateTokens = async (tokenIds: TokenId[]) => {
    for (const tokenId of tokenIds) {
      await executorWrapper.associateToken({
        accountId: executor.accountId.toString(),
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

    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const balances = await executorWrapper.getAccountTokenBalances(executor.accountId.toString());
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

    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const balances = await executorWrapper.getAccountTokenBalances(executor.accountId.toString());
    expect(balances.find(b => b.tokenId === tokenIdFT.toString())).toBeFalsy();
    expect(balances.find(b => b.tokenId === tokenIdNFT.toString())).toBeFalsy();
  });

  it('should fail dissociating a token not associated', async () => {
    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString()],
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.errorCode).toBe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.humanMessage).toContain('Failed to execute Dissociate Token');
  });

  it('should fail dissociating a non-existent token', async () => {
    const tool = dissociateTokenTool(context);
    const params: z.infer<ReturnType<typeof dissociateTokenParameters>> = {
      tokenIds: ['0.0.9999999'],
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.errorCode).toBe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.humanMessage).toContain('Failed to execute Dissociate Token');
  });
});
