import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TopicId, PublicKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { wait, extractObservationFromLangchainResponse } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Topic Info Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let createdTopicId: TopicId;
  let topicAdminKey: PublicKey;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Operator creates executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Executor creates topic
    topicAdminKey = executorClient.operatorPublicKey!;
    createdTopicId = await executorWrapper
      .createTopic({
        isSubmitKey: false,
        adminKey: topicAdminKey,
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.topicId!);

    // Submit one message just to make sure topic appears on mirror
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Topic Info Warmup',
    });

    // Wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
  });

  afterAll(async () => {
    // Cleanup topic and executor account
    await executorWrapper.deleteTopic({ topicId: createdTopicId.toString() });

    // delete an executor account and transfer remaining balance to operator
    await executorWrapper.deleteAccount({
      accountId: executorClient.operatorAccountId!,
      transferAccountId: operatorClient.operatorAccountId!,
    });

    operatorClient.close();
    executorClient.close();
    testSetup.cleanup();
  });

  it('should fetch topic info via LangChain agent', itWithRetry(async () => {
    const input = `Get topic info for ${createdTopicId.toString()}`;

    const queryResult = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.raw).toBeDefined();
    expect(observation.raw.topicId).toBe(createdTopicId.toString());
    expect(observation.raw.topicInfo.topic_id).toBe(createdTopicId.toString());
    expect(observation.humanMessage).toContain('Here are the details for topic');
  }));
});


