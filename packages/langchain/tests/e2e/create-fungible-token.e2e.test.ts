import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { Client, TokenId } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Create Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let responseParsingService: ResponseParserService;

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
    'creates a fungible token with minimal params via natural language',
    async () => {
      const input = `Create a fungible token named MyToken with symbol MTK`;

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

      expect(parsedResponse[0]).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      // Verify on-chain
      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('MyToken');
      expect(tokenInfo.symbol).toBe('MTK');
      expect(tokenInfo.decimals).toBe(0);
    },
  );

  it(
    'creates a fungible token with supply, decimals, and finite supply type',
    async () => {
      const input =
        'Create a fungible token GoldCoin with symbol GLD, initial supply 1000, decimals 2, finite supply with max supply 5000';

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

      expect(parsedResponse[0]).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token created successfully');
      expect(parsedResponse[0].parsedData.raw.tokenId).toBeDefined();

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('GoldCoin');
      expect(tokenInfo.symbol).toBe('GLD');
      expect(tokenInfo.decimals).toBe(2);
      expect(tokenInfo.totalSupply.toInt()).toBeGreaterThan(0);
      expect(tokenInfo.maxSupply?.toInt()).toBe(500000); // accounts for 2 decimals
    },
  );

  it(
    'should schedule creation of a FT successfully',
    async () => {
      const input = `Create a fungible token named MyToken with symbol MTK. Schedule the transaction instead of executing it immediately.`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0]).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled transaction created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    },
  );
});
