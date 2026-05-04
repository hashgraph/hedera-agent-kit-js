import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey, TokenSupplyType } from '@hiero-ledger/sdk';
import associateTokenTool from '@/plugins/core-token-plugin/tools/associate-token';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { associateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Associate Token Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let tokenExecutor: TestAccount;
  let executorClient: Client;
  let tokenExecutorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenExecutorWrapper: HederaOperationsWrapper;
  let context: Context;

  const FT_PARAMS = {
    tokenName: 'AssocToken',
    tokenSymbol: 'ASSOC',
    tokenMemo: 'FT',
    initialSupply: 0,
    decimals: 0,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    tokenExecutor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: tokenExecutorClient, wrapper: tokenExecutorWrapper } =
      profile.client.connectAs(tokenExecutor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    await profile.accounts.release(tokenExecutor);
    executorClient?.close();
    tokenExecutorClient?.close();
  });

  it('should associate token to the executor account', async () => {
    const createTokenResp = await tokenExecutorWrapper.createFungibleToken({
      ...FT_PARAMS,
      supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
      adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
      treasuryAccountId: tokenExecutor.accountId.toString(),
      autoRenewAccountId: tokenExecutor.accountId.toString(),
    });
    const tokenIdFT = createTokenResp.tokenId!;
    await waitForMirrorTx(tokenExecutorWrapper, createTokenResp.transactionId!);
    const tool = associateTokenTool(context);
    const params: z.infer<ReturnType<typeof associateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString()],
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const balances = await executorWrapper.getAccountBalances(
      executor.accountId.toString(),
    );
    const associated = balances.tokens.some(t => t.token_id === tokenIdFT.toString());

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('Tokens successfully associated');
    expect(associated).toBe(true);
  });

  it('should associate two tokens to the executor account', async () => {
    // Create first token
    const createToken1Resp = await tokenExecutorWrapper.createFungibleToken({
      tokenName: 'AssocToken',
      tokenSymbol: 'ASSOC',
      tokenMemo: 'FT',
      initialSupply: 0,
      decimals: 0,
      maxSupply: 1000,
      supplyType: TokenSupplyType.Finite,
      supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
      adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
      treasuryAccountId: tokenExecutor.accountId.toString(),
      autoRenewAccountId: tokenExecutor.accountId.toString(),
    });
    const tokenIdFT1 = createToken1Resp.tokenId!;
    // Create a second token
    const createToken2Resp = await tokenExecutorWrapper.createFungibleToken({
      tokenName: 'AssocToken2',
      tokenSymbol: 'ASSOC2',
      tokenMemo: 'FT2',
      initialSupply: 0,
      decimals: 0,
      maxSupply: 1000,
      supplyType: TokenSupplyType.Finite,
      supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
      adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
      treasuryAccountId: tokenExecutor.accountId.toString(),
      autoRenewAccountId: tokenExecutor.accountId.toString(),
    });
    const tokenIdFT2 = createToken2Resp.tokenId!;

    await waitForMirrorTx(tokenExecutorWrapper, createToken2Resp.transactionId!);

    const tool = associateTokenTool(context);
    const params: z.infer<ReturnType<typeof associateTokenParameters>> = {
      tokenIds: [tokenIdFT1.toString(), tokenIdFT2.toString()],
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const balances = await executorWrapper.getAccountBalances(
      executor.accountId.toString(),
    );
    const associatedFirst = balances.tokens.some(t => t.token_id === tokenIdFT1.toString());
    const associatedSecond = balances.tokens.some(t => t.token_id === tokenIdFT2.toString());

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(associatedFirst).toBe(true);
    expect(associatedSecond).toBe(true);
  });
});
