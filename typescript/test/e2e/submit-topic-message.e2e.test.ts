import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, Key, PrivateKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Submit Topic Message E2E Tests with Pre-Created Topics', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executionWrapper: HederaOperationsWrapper;
  let targetTopicId: string;

  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey as Key, initialBalance: 5 })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executionWrapper = new HederaOperationsWrapper(executorClient);

    // setting up langchain to run with the execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await executionWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // create a fresh topic for each test
    const created = await executionWrapper.createTopic({
      topicMemo: 'e2e-test-topic',
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      isSubmitKey: false,
    });
    targetTopicId = created.topicId!.toString();
  });

  it('should submit a message to a pre-created topic via agent', itWithRetry(async () => {
    const message = '"submitted via agent"';
    const res = await agentExecutor.invoke({
      input: `Submit message ${message} to topic ${targetTopicId}`,
    });

    const observation = extractObservationFromLangchainResponse(res);

    expect(observation.humanMessage).toMatch(/submitted/i);
    expect(
      observation.humanMessage.includes('transaction') ||
        /Message submitted successfully|submitted/i.test(observation.humanMessage),
    ).toBeTruthy();

    await wait(MIRROR_NODE_WAITING_TIME);

    const mirrornodeMessages = await operatorWrapper.getTopicMessages(targetTopicId);

    expect(mirrornodeMessages.messages.length).toBeGreaterThan(0);
  }));

  it('should fail to submit to a non-existent topic via agent', itWithRetry(async () => {
    const fakeTopicId = '0.0.999999999';
    const res = await agentExecutor.invoke({
      input: `Submit message "x" to topic ${fakeTopicId}`,
    });

    const observation = extractObservationFromLangchainResponse(res);
    expect(observation.humanMessage || JSON.stringify(observation)).toMatch(
      /INVALID_TOPIC_ID|NOT_FOUND|ACCOUNT_DELETED|INVALID_ARGUMENT/i,
    );
  }));
});
