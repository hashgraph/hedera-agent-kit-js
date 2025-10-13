import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  PrivateKey,
  AccountId,
  PublicKey,
  TokenId,
  TokenType,
  TokenSupplyType,
} from '@hashgraph/sdk';
import mintNonFungibleTokenTool from '@/plugins/core-token-plugin/tools/non-fungible-token/mint-non-fungible-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { mintNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Mint Non-Fungible Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let nftTokenId: TokenId;
  let context: Context;

  const NFT_PARAMS = {
    tokenName: 'MintableNFT',
    tokenSymbol: 'MNFT',
    tokenMemo: 'NFT',
    tokenType: TokenType.NonFungibleUnique,
    supplyType: TokenSupplyType.Finite,
    maxSupply: 100,
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

    nftTokenId = await executorWrapper
      .createNonFungibleToken({
        ...NFT_PARAMS,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
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

  it('should mint a single NFT for the token', async () => {
    const tool = mintNonFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> = {
      tokenId: nftTokenId.toString(),
      uris: ['ipfs://metadata1.json'],
    };

    const supplyBefore = await executorWrapper
      .getTokenInfo(nftTokenId.toString())
      .then(info => info.totalSupply.toInt());
    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);
    const supplyAfter = await executorWrapper
      .getTokenInfo(nftTokenId.toString())
      .then(info => info.totalSupply.toInt());

    expect(result).toBeDefined();
    expect(result.humanMessage).toContain('Token successfully minted');
    expect(supplyAfter).toBe(supplyBefore + 1);
  });

  it('should mint multiple NFTs at once', async () => {
    const tool = mintNonFungibleTokenTool(context);
    const uris = ['ipfs://meta1.json', 'ipfs://meta2.json', 'ipfs://meta3.json'];
    const params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> = {
      tokenId: nftTokenId.toString(),
      uris,
    };

    const supplyBefore = await executorWrapper
      .getTokenInfo(nftTokenId.toString())
      .then(info => info.totalSupply.toInt());
    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);
    const supplyAfter = await executorWrapper
      .getTokenInfo(nftTokenId.toString())
      .then(info => info.totalSupply.toInt());

    expect(result).toBeDefined();
    expect(result.humanMessage).toContain('Token successfully minted');
    expect(supplyAfter).toBe(supplyBefore + uris.length);
  });

  it('should schedule minting of additional supply for an existing non fungible token', async () => {
    const tool = mintNonFungibleTokenTool(context);
    const uris = ['ipfs://meta1.json', 'ipfs://meta2.json', 'ipfs://meta3.json'];
    const params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> = {
      tokenId: nftTokenId.toString(),
      uris,
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

  it('should fail gracefully for a non-existent NFT token', async () => {
    const tool = mintNonFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> = {
      tokenId: '0.0.999999999',
      uris: ['ipfs://meta.json'],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result).toBeDefined();
    expect(result.humanMessage).toContain('INVALID_TOKEN_ID');
    expect(result.raw.error).toContain('INVALID_TOKEN_ID');
  });
});
