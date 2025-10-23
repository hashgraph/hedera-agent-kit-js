import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  PrivateKey,
  AccountId,
  TokenId,
  TokenType,
  PublicKey,
  TokenSupplyType,
} from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Mint Non-Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let nftTokenId: TokenId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

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
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

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

  it(
    'should mint a single NFT successfully',
    itWithRetry(async () => {
      const supplyBefore = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      const queryResult = await agentExecutor.invoke({
        input: `Mint 1 NFT of token ${nftTokenId.toString()} with metadata ipfs://meta1.json`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const supplyAfter = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      expect(observation.humanMessage).toContain('Token successfully minted.');
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

      const queryResult = await agentExecutor.invoke({
        input: `Mint ${uris.length} NFTs of token ${nftTokenId.toString()} with metadata ${uris.join(
          ', ',
        )}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const supplyAfter = await executorWrapper
        .getTokenInfo(nftTokenId.toString())
        .then(info => info.totalSupply.toInt());

      expect(observation.humanMessage).toContain('Token successfully minted.');
      expect(supplyAfter).toBe(supplyBefore + uris.length);
    }),
  );

  it(
    'should schedule minting a single NFT successfully',
    itWithRetry(async () => {
      const updateResult = await agentExecutor.invoke({
        input: `Mint 1 NFT of token ${nftTokenId.toString()} with metadata 'ipfs://meta1.json'. Schedule the transaction instead of executing it immediately.`,
      });

      const observation = extractObservationFromLangchainResponse(updateResult);
      expect(observation.humanMessage).toContain('Scheduled mint transaction created successfully');
      expect(observation.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'should fail gracefully for a non-existent NFT token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agentExecutor.invoke({
        input: `Mint 1 NFT of token ${fakeTokenId} with metadata ipfs://meta.json`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toMatch(/INVALID_TOKEN_ID|Failed to mint/i);
    }),
  );
});
