import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client, TokenId } from '@hiero-ledger/sdk';

describe('Create Non-Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

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
      const treasuryAccountId = executor.accountId.toString();
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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

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
      const input =
        'Create a non-fungible token InfiniteCollection with symbol INF and infinite supply';

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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('InfiniteCollection');
      expect(tokenInfo.symbol).toBe('INF');
      expect(tokenInfo.tokenType!.toString()).toBe('NON_FUNGIBLE_UNIQUE');
      expect(tokenInfo.supplyType!.toString()).toBe('INFINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(0); // infinite supply has maxSupply of 0
    }),
  );
});
