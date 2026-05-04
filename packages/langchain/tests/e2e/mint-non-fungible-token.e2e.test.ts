import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  TokenId,
  TokenType,
  PublicKey,
  TokenSupplyType,
} from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Mint Non-Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let nftTokenId: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  const NFT_PARAMS = {
    tokenName: 'MintableNFT',
    tokenSymbol: 'MNFT',
    tokenMemo: 'NFT',
    tokenType: TokenType.NonFungibleUnique,
    supplyType: TokenSupplyType.Finite,
    maxSupply: 100,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    nftTokenId = await executorWrapper
      .createNonFungibleToken({
        ...NFT_PARAMS,
        adminKey: executor.privateKey.publicKey as PublicKey,
        supplyKey: executor.privateKey.publicKey as PublicKey,
        treasuryAccountId: executor.accountId.toString(),
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should mint a single NFT successfully',
    itWithRetry(async () => {
      const supplyBefore = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 1 NFT of token ${nftTokenId.toString()} with metadata ipfs://meta1.json`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const supplyAfter = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token successfully minted.');
      expect(supplyAfter).toBe(supplyBefore + 1);
    }),
  );

  it(
    'should mint multiple NFTs successfully',
    itWithRetry(async () => {
      const uris = ['ipfs://meta2.json', 'ipfs://meta3.json', 'ipfs://meta4.json'];
      const supplyBefore = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint ${uris.length} NFTs of token ${nftTokenId.toString()} with metadata ${uris.join(
              ', ',
            )}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const supplyAfter = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token successfully minted.');
      expect(supplyAfter).toBe(supplyBefore + uris.length);
    }),
  );

  it(
    'should schedule minting a single NFT successfully',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 1 NFT of token ${nftTokenId.toString()} with metadata 'ipfs://meta1.json'. Schedule the transaction instead of executing it immediately.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled mint transaction created successfully',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'should fail gracefully for a non-existent NFT token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 1 NFT of token ${fakeTokenId} with metadata ipfs://meta.json`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toMatch(/INVALID_TOKEN_ID|Failed to mint/i);
    }),
  );
});
