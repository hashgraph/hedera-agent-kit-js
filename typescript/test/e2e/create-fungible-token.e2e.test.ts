import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { Client, PrivateKey } from '@hashgraph/sdk';
import {
  extractObservationFromLangchainResponse,
  extractTokenIdFromObservation,
  wait,
} from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Create Fungible Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    // 2. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 3. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const tokenId = extractTokenIdFromObservation(observation);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token created successfully');
      expect(observation.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      // Verify on-chain
      const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const tokenId = extractTokenIdFromObservation(observation);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token created successfully');
      expect(observation.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
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
      const updateResult = await agentExecutor.invoke({
        input: `Create a fungible token named MyToken with symbol MTK. Schedule the transaction instead of executing it immediately.`,
      });

      const observation = extractObservationFromLangchainResponse(updateResult);
      expect(observation.humanMessage).toContain('Scheduled transaction created successfully.');
      expect(observation.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'handles invalid requests gracefully',
    itWithRetry(async () => {
      const input =
        'Create a fungible token BrokenToken with symbol BRK, initial supply 2000 and max supply 1000';

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('cannot exceed max supply');
      expect(observation.raw.error).toBeDefined();
    }),
  );
});
