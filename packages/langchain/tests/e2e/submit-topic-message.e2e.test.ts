import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Submit Topic Message E2E Tests with Pre-Created Topics', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let targetTopicId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // setting up langchain to run with the execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    // create a fresh topic for each test
    const created = await executorWrapper.createTopic({
      topicMemo: 'e2e-test-topic',
      autoRenewAccountId: executor.accountId.toString(),
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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const mirrornodeMessages = await executorWrapper.getTopicMessages(targetTopicId);

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
