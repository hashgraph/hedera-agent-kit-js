import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import { getOperatorClientForTests, getCustomClient } from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/shared/langchain-test-setup';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { Client, PrivateKey, TokenId } from '@hiero-ledger/sdk';
import { wait } from '@hashgraph/hedera-agent-kit-tests/shared/general-util';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests/shared/test-constants';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { ReactAgent } from 'langchain';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/shared/langchain-test-config';

describe('Create Fungible Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
      })
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
    'creates a fungible token with minimal params via natural language',
    itWithRetry(async () => {
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

      await wait(MIRROR_NODE_WAITING_TIME);

      // Verify on-chain
      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('MyToken');
      expect(tokenInfo.symbol).toBe('MTK');
      expect(tokenInfo.decimals).toBe(0);
    }),
  );

  it(
    'creates a fungible token with supply, decimals, and finite supply type',
    itWithRetry(async () => {
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

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId.toString());
      expect(tokenInfo.name).toBe('GoldCoin');
      expect(tokenInfo.symbol).toBe('GLD');
      expect(tokenInfo.decimals).toBe(2);
      expect(tokenInfo.totalSupply.toInt()).toBeGreaterThan(0);
      expect(tokenInfo.maxSupply?.toInt()).toBe(500000); // accounts for 2 decimals
    }),
  );

  it(
    'should schedule creation of a FT successfully',
    itWithRetry(async () => {
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
    }),
  );
});
