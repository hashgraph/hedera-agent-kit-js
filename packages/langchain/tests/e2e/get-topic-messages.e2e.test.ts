import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TopicId, PublicKey } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  getCustomClient,
  getOperatorClientForTests,
} from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { wait } from '@hashgraph/hedera-agent-kit-tests/shared/general-util';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests/shared/test-constants';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/utils';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';

describe('Get Topic Messages Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let createdTopicId: TopicId;
  let topicAdminKey: PublicKey;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Operator creates executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL),
      })
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
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'E2E Message 3',
    });

    // Wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await returnHbarsAndDeleteAccount(
      executorWrapper,
      executorClient.operatorAccountId!,
      operatorClient.operatorAccountId!,
    );

    operatorClient.close();
    executorClient.close();
    testSetup.cleanup();
  });

  it(
    'should fetch all messages from a topic via LangChain agent',
    itWithRetry(async () => {
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
    }),
  );

  it(
    'should fetch messages after a specific timestamp via LangChain agent',
    itWithRetry(async () => {
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
    }),
  );

  it(
    'should handle non-existent topic gracefully via LangChain agent',
    itWithRetry(async () => {
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
    }),
  );
});
