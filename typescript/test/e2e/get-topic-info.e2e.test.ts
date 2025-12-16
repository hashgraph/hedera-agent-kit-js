import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TopicId, PublicKey } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

describe('Get Topic Info Query E2E Tests', () => {
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
      .createAccount({ key: executorKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL) })
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
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
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

  it(
    'should fetch topic info via LangChain agent',
    itWithRetry(async () => {
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
    }),
  );
});
