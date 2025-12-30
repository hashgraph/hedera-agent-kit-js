import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';

describe('Submit Topic Message E2E Tests with Pre-Created Topics', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
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
      .createAccount({
        key: executorAccountKey.publicKey as Key,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL),
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executionWrapper = new HederaOperationsWrapper(executorClient);

    // setting up langchain to run with the execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executionWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );

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

  it(
    'should submit a message to a pre-created topic via agent',
    itWithRetry(async () => {
      const message = '"submitted via agent"';
      const res = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Submit message ${message} to topic ${targetTopicId}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(res);

      expect(parsedResponse[0].parsedData.humanMessage).toMatch(/submitted/i);
      expect(
        parsedResponse[0].parsedData.humanMessage.includes('transaction') ||
          /Message submitted successfully|submitted/i.test(
            parsedResponse[0].parsedData.humanMessage,
          ),
      ).toBeTruthy();

      await wait(MIRROR_NODE_WAITING_TIME);

      const mirrornodeMessages = await operatorWrapper.getTopicMessages(targetTopicId);

      expect(mirrornodeMessages.messages.length).toBeGreaterThan(0);
    }),
  );

  it(
    'should fail to submit to a non-existent topic via agent',
    itWithRetry(async () => {
      const fakeTopicId = '0.0.999999999';
      const res = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Submit message "x" to topic ${fakeTopicId}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(res);
      expect(parsedResponse[0].parsedData.humanMessage).toMatch(
        /INVALID_TOPIC_ID|NOT_FOUND|ACCOUNT_DELETED|INVALID_ARGUMENT/i,
      );
    }),
  );
});
