import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TopicId, PublicKey } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Get Topic Messages Query E2E Tests', () => {
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

    // Submit some messages
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Message 1',
    });
    await wait(1000);
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Message 2',
    });
    await wait(1000);
    const submit3Resp = await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Message 3',
    });

    // Wait for mirror node indexing
    await waitForMirrorTx(executorWrapper, submit3Resp.transactionId!);

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should fetch all messages from a topic via LangChain agent',
    async () => {
      const input = `Get all messages from topic ${createdTopicId.toString()}`;

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
      expect(parsedResponse[0].parsedData.raw.messages.length).toBe(3);
      expect(
        parsedResponse[0].parsedData.raw.messages.reverse().map((m: any) => m.message),
      ).toEqual(['E2E Message 1', 'E2E Message 2', 'E2E Message 3']);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Messages for topic');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('E2E Message 1');
    },
  );

  it(
    'should fetch messages after a specific timestamp via LangChain agent',
    async () => {
      // Fetch all messages first to get timestamp
      const allMessages = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Get all messages from topic ${createdTopicId.toString()}`,
          },
        ],
      });
      const parsedResponseAll = responseParsingService.parseNewToolMessages(allMessages);
      const message2Timestamp = parsedResponseAll[0].parsedData.raw.messages[1].consensus_timestamp;
      const startTime = new Date(Number(message2Timestamp.split('.')[0]) * 1000).toISOString();

      const input = `Get messages from topic ${createdTopicId.toString()} after ${startTime}`;

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw.messages.length).toBe(2); // Message 2 and Message 3
      expect(
        parsedResponse[0].parsedData.raw.messages.reverse().map((m: any) => m.message),
      ).toEqual(['E2E Message 2', 'E2E Message 3']);
    },
  );

  it(
    'should handle non-existent topic gracefully via LangChain agent',
    async () => {
      const fakeTopicId = '0.0.999999999';
      const input = `Get messages from topic ${fakeTopicId}`;

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('No messages found for topic');
    },
  );
});
