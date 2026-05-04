import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import mintFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/mint-fungible-token';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { mintFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';

describe('Mint Fungible Token Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
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
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        treasuryAccountId: executor.accountId.toString(),
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
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
