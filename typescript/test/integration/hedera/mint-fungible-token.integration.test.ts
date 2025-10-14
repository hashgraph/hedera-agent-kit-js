import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import mintFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/mint-fungible-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { mintFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Mint Fungible Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let context: Context;

  const FT_PARAMS = {
    tokenName: 'MintableToken',
    tokenSymbol: 'MINT',
    tokenMemo: 'FT',
    initialSupply: 100,
    decimals: 2,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 15 })
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

  it('should mint additional supply for an existing fungible token', async () => {
    const tool = mintFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      amount: 5, // 500 in base unit
    };

    const supplyBefore = await executorWrapper
      .getTokenInfo(tokenIdFT.toString())
      .then(info => info.totalSupply.toInt());
    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);
    const supplyAfter = await executorWrapper
      .getTokenInfo(tokenIdFT.toString())
      .then(info => info.totalSupply.toInt());

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('Tokens successfully minted.');
    expect(supplyAfter).toBe(supplyBefore + 500);
  });

  it('should schedule minting of additional supply for an existing fungible token', async () => {
    const tool = mintFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      amount: 5, // 500 in base unit
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: true,
      },
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('Scheduled mint transaction created successfully.');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.raw.scheduleId).toBeDefined();
  });

  it('should fail gracefully when minting more than max supply', async () => {
    const tool = mintFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      amount: 5000, // exceeds max supply
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw).toBeDefined();
    expect(result.raw.error).toContain('TOKEN_MAX_SUPPLY_REACHED');
  });

  it('should fail gracefully for a non-existent token', async () => {
    const tool = mintFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintFungibleTokenParameters>> = {
      tokenId: '0.0.999999999',
      amount: 10,
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Not Found');
    expect(result.humanMessage).toContain('Failed to mint fungible token');
  });
});
