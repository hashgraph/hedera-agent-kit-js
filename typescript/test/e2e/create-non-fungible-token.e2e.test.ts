import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { Client, PrivateKey, TokenId } from '@hashgraph/sdk';
import {
  wait,
} from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';

describe('Create Non-Fungible Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(1.50) })
      .then(resp => resp.accountId!);

    // 2. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 3. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      operatorClient.close();
      executorClient.close();
    }
  });

  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 30000));
  });

  it(
    'creates an NFT with minimal params via natural language',
    itWithRetry(async () => {
      const input = `Create a non-fungible token named MyNFT with symbol MNFT`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      const rawTokenId = parsedResponse[0].parsedData.raw.tokenId;
      const tokenId = new TokenId(rawTokenId.shard.low, rawTokenId.realm.low, rawTokenId.num.low);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      // Verify on-chain
      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('MyNFT');
      expect(tokenInfo.symbol).toBe('MNFT');
      expect(tokenInfo.tokenType!.toString()).toBe('NON_FUNGIBLE_UNIQUE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(100); // default maxSupply
    }),
  );

  it(
    'creates an NFT with custom max supply',
    itWithRetry(async () => {
      const input = 'Create a non-fungible token ArtCollection with symbol ART and max supply 500';

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      const rawTokenId = parsedResponse[0].parsedData.raw.tokenId;
      const tokenId = new TokenId(rawTokenId.shard.low, rawTokenId.realm.low, rawTokenId.num.low);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('ArtCollection');
      expect(tokenInfo.symbol).toBe('ART');
      expect(tokenInfo.tokenType!.toString()).toBe('NON_FUNGIBLE_UNIQUE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(500);
    }),
  );

  it(
    'creates an NFT with treasury account specification',
    itWithRetry(async () => {
      const treasuryAccountId = executorClient.operatorAccountId!.toString();
      const input = `Create a non-fungible token GameItems with symbol GAME, treasury account ${treasuryAccountId}, and max supply 1000`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      const rawTokenId = parsedResponse[0].parsedData.raw.tokenId;
      const tokenId = new TokenId(rawTokenId.shard.low, rawTokenId.realm.low, rawTokenId.num.low);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('GameItems');
      expect(tokenInfo.symbol).toBe('GAME');
      expect(tokenInfo.treasuryAccountId?.toString()).toBe(treasuryAccountId);
      expect(tokenInfo.maxSupply?.toInt()).toBe(1000);
    }),
  );

  it(
    'should schedule creation of a NFT successfully',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Create a non-fungible token named MyNFT with symbol MNFT. Schedule the transaction instead of executing it immediately.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled transaction created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'creates an NFT with infinite supply',
    itWithRetry(async () => {
      const input = 'Create a non-fungible token InfiniteCollection with symbol INF and infinite supply';

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      const rawTokenId = parsedResponse[0].parsedData.raw.tokenId;
      const tokenId = new TokenId(rawTokenId.shard.low, rawTokenId.realm.low, rawTokenId.num.low);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('InfiniteCollection');
      expect(tokenInfo.symbol).toBe('INF');
      expect(tokenInfo.tokenType!.toString()).toBe('NON_FUNGIBLE_UNIQUE');
      expect(tokenInfo.supplyType!.toString()).toBe('INFINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(0); // infinite supply has maxSupply of 0
    }),
  );
});
