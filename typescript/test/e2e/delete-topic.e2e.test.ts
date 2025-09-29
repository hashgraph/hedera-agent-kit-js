import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { AgentExecutor } from 'langchain/agents';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Delete Topic E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let executorKey: PrivateKey;
  let executorAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 20 })
      .then(r => r.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

    // create a topic to delete
    const createInput = 'Create a new Hedera topic';
    const createResult = await agentExecutor.invoke({ input: createInput });
    const createObservation = extractObservationFromLangchainResponse(createResult);
    if (!createObservation.raw?.topicId) throw new Error('Failed to create topic for delete test');
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

  it('deletes topic via natural language', itWithRetry(async () => {
    // create a topic to be deleted
    const createParams: any = { adminKey: executorClient.operatorPublicKey };
    const createResult: any = await executorWrapper.createTopic(createParams);
    if (!createResult.topicId) throw new Error('Failed to create topic for delete test');

    const input = `Delete topic ${createResult.topicId!}`;
    const res = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(res);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Topic with id');
    expect(observation.raw.transactionId).toBeDefined();

    await wait(MIRROR_NODE_WAITING_TIME);
  }));
});
