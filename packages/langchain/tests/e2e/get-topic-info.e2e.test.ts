import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TopicId, PublicKey } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Get Topic Info Query E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let createdTopicId: TopicId;
  let topicAdminKey: PublicKey;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Executor creates topic
    topicAdminKey = executor.privateKey.publicKey;
    const createTopicResp = await executorWrapper.createTopic({
      isSubmitKey: false,
      adminKey: topicAdminKey,
      autoRenewAccountId: executor.accountId.toString(),
    });
    createdTopicId = createTopicResp.topicId!;

    // Submit one message just to make sure topic appears on mirror
    const submitResp = await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Topic Info Warmup',
    });

    // Wait for mirror node indexing
    await waitForMirrorTx(executorWrapper, submitResp.transactionId!);

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await executorWrapper.deleteTopic({ topicId: createdTopicId.toString() });
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should fetch topic info via LangChain agent',
    async () => {
      const input = `Get topic info for ${createdTopicId.toString()}`;

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.topicId).toBe(createdTopicId.toString());
      expect(parsedResponse[0].parsedData.raw.topicInfo.topic_id).toBe(createdTopicId.toString());
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Here are the details for topic');
    },
  );
});
