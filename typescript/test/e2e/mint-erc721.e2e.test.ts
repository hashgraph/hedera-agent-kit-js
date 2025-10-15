import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Mint ERC721 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: 20,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);

    // 2. Create a recipient account (with the same public key as the executor for simplicity)
    recipientAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!.toString());

    // 3. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    await wait(MIRROR_NODE_WAITING_TIME);

    // 5. Create a test ERC721 token
    const createInput = 'Create an ERC721 token named MintTest with symbol MNT';
    const createResult = await agentExecutor.invoke({ input: createInput });
    const createObservation = extractObservationFromLangchainResponse(createResult);

    if (!createObservation.erc721Address) {
      throw new Error('Failed to create test ERC721 token for minting');
    }

    testTokenAddress = createObservation.erc721Address;
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        AccountId.fromString(recipientAccountId),
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      operatorClient.close();
      executorClient.close();
    }
  });

  it(
    'mints ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const input = `Mint ERC721 token form contract: ${testTokenAddress} to ${recipientAccountId}`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'mints token to default (context) account when toAddress missing',
    itWithRetry(async () => {
      const input = `Mint ERC721 token ${testTokenAddress}`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();
    }),
  );

  it.skip(
    'handles various natural language variations for minting',
    itWithRetry(async () => {
      const variations = [
        `Mint NFT (ERC-721) from ${testTokenAddress} to ${recipientAccountId}`,
        `Create EVM compatible NFT from contract ${testTokenAddress} to ${recipientAccountId}`,
        `Mint a token from ${testTokenAddress} (ERC721 contract) for ${recipientAccountId}`,
      ];

      for (const input of variations) {
        const result = await agentExecutor.invoke({ input });
        const observation = extractObservationFromLangchainResponse(result);

        expect(observation).toBeDefined();
        expect(observation.raw.status).toBe('SUCCESS');
        expect(observation.raw.transactionId).toBeDefined();
      }
    }),
  );

  it(
    'schedules minting ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const input = `Mint ERC721 token form contract: ${testTokenAddress} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      // Validate response structure
      expect(observation.raw).toBeDefined();
      expect(observation.raw.transactionId).toBeDefined();
      expect(observation.raw.scheduleId).not.toBeNull();
      expect(observation.humanMessage).toContain('Scheduled minting of ERC721 successfully.');
    }),
  );
});
