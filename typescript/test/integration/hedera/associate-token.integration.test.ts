import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TokenSupplyType } from '@hashgraph/sdk';
import associateTokenTool from '@/plugins/core-token-plugin/tools/associate-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { associateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Associate Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let tokenExecutorClient: Client;
  let executorAccountId: AccountId;
  let tokenExecutorAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let tokenExecutorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
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
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    const tokenExecutorKey = PrivateKey.generateED25519();
    tokenExecutorAccountId = await operatorWrapper
      .createAccount({ key: tokenExecutorKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    tokenExecutorClient = getCustomClient(tokenExecutorAccountId, tokenExecutorKey);
    tokenExecutorWrapper = new HederaOperationsWrapper(tokenExecutorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorClient.operatorAccountId!.toString(),
    };

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
    }
    if (tokenExecutorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        tokenExecutorWrapper,
        tokenExecutorAccountId,
        operatorClient.operatorAccountId!,
      );
      tokenExecutorClient.close();
    }
    operatorClient.close();
  });

  it('should associate token to the executor account', async () => {
    let tokenIdFT = await tokenExecutorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: tokenExecutorAccountId.toString(),
        autoRenewAccountId: tokenExecutorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);
    const tool = associateTokenTool(context);
    const params: z.infer<ReturnType<typeof associateTokenParameters>> = {
      tokenIds: [tokenIdFT.toString()],
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    const balances = await executorWrapper.getAccountBalances(
      executorClient.operatorAccountId!.toString(),
    );
    const associated = (balances.tokens?.get(tokenIdFT) ?? 0) >= 0;

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('Tokens successfully associated');
    expect(associated).toBe(true);
  });

  it('should associate two tokens to the executor account', async () => {
    // Create first token
    const tokenIdFT1 = await tokenExecutorWrapper
      .createFungibleToken({
        tokenName: 'AssocToken',
        tokenSymbol: 'ASSOC',
        tokenMemo: 'FT',
        initialSupply: 0,
        decimals: 0,
        maxSupply: 1000,
        supplyType: TokenSupplyType.Finite,
        supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: tokenExecutorAccountId.toString(),
        autoRenewAccountId: tokenExecutorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);
    // Create a second token
    const tokenIdFT2 = await tokenExecutorWrapper
      .createFungibleToken({
        tokenName: 'AssocToken2',
        tokenSymbol: 'ASSOC2',
        tokenMemo: 'FT2',
        initialSupply: 0,
        decimals: 0,
        maxSupply: 1000,
        supplyType: TokenSupplyType.Finite,
        supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: tokenExecutorAccountId.toString(),
        autoRenewAccountId: tokenExecutorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = associateTokenTool(context);
    const params: z.infer<ReturnType<typeof associateTokenParameters>> = {
      tokenIds: [tokenIdFT1.toString(), tokenIdFT2.toString()],
    } as any;

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    const balances = await executorWrapper.getAccountBalances(
      executorClient.operatorAccountId!.toString(),
    );
    const associatedFirst = (balances.tokens?.get(tokenIdFT1) ?? 0) >= 0;
    const associatedSecond = (balances.tokens?.get(tokenIdFT2) ?? 0) >= 0;

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(associatedFirst).toBe(true);
    expect(associatedSecond).toBe(true);
  });
});
