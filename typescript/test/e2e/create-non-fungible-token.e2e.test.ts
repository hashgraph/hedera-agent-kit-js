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

describe('Create Non-Fungible Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create executor account (funded by operator)
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
    'creates an NFT with minimal params via natural language',
    itWithRetry(async () => {
      const input = `Create a non-fungible token named MyNFT with symbol MNFT`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const tokenId = extractTokenIdFromObservation(observation);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token created successfully');
      expect(observation.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      // Verify on-chain
      const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const tokenId = extractTokenIdFromObservation(observation);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token created successfully');
      expect(observation.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const tokenId = extractTokenIdFromObservation(observation);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token created successfully');
      expect(observation.raw.tokenId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
      expect(tokenInfo.name).toBe('GameItems');
      expect(tokenInfo.symbol).toBe('GAME');
      expect(tokenInfo.treasuryAccountId?.toString()).toBe(treasuryAccountId);
      expect(tokenInfo.maxSupply?.toInt()).toBe(1000);
    }),
  );

  it(
    'should schedule creation of a NFT successfully',
    itWithRetry(async () => {
      const updateResult = await agentExecutor.invoke({
        input: `Create a non-fungible token named MyNFT with symbol MNFT. Schedule the transaction instead of executing it immediately.`,
      });

      const observation = extractObservationFromLangchainResponse(updateResult);
      expect(observation.humanMessage).toContain('Scheduled transaction created successfully.');
      expect(observation.raw.scheduleId).toBeDefined();
    }),
  );
});
