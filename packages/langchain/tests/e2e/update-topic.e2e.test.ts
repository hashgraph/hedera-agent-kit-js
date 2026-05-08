import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PrivateKey, PublicKey, TopicId } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Update Topic E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let topicId: TopicId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  beforeEach(async () => {
    // Create a topic with admin and submit keys so most tests can run updates
    const createTopicResp = await executorWrapper.createTopic({
      autoRenewAccountId: executor.accountId.toString(),
      isSubmitKey: true,
      adminKey: executor.privateKey.publicKey as PublicKey,
      submitKey: executor.privateKey.publicKey as PublicKey,
      topicMemo: 'initial-topic-memo',
    });
    topicId = createTopicResp.topicId!;

    // Give mirror node time to index
    await waitForMirrorTx(executorWrapper, createTopicResp.transactionId!);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should change topic keys using passed values',
    async () => {
      const newSubmitKey = PrivateKey.generateED25519().publicKey.toString();

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For topic ${topicId.toString()} the submit key to: ${newSubmitKey}.`,
          },
        ],
      });

      const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());
      expect((topicDetails.adminKey as PublicKey).toString()).toBe(
        executor.privateKey.publicKey.toString(),
      );
      expect((topicDetails.submitKey as PublicKey).toString()).toBe(newSubmitKey);
    },
  );

  it(
    'should change topic keys using default values (my key)',
    async () => {
      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For topic ${topicId.toString()}
      ], change the submit key to my key and set the topic memo to 'just updated'`,
          },
        ],
      });

      const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());
      expect((topicDetails.submitKey as PublicKey).toStringDer()).toBe(
        executor.privateKey.publicKey.toStringDer(),
      );
      expect(topicDetails.topicMemo).toBe('just updated');
    },
  );

  it(
    'should fail due to topic being originally created without submitKey',
    async () => {
      // Create a topic without a submitKey
      const createTopicWithoutSubmitResp = await executorWrapper.createTopic({
        autoRenewAccountId: executor.accountId.toString(),
        isSubmitKey: false,
        adminKey: executor.privateKey.publicKey as PublicKey,
        topicMemo: 'no-submit',
      });
      const topicWithoutSubmit = createTopicWithoutSubmitResp.topicId!;

      await waitForMirrorTx(executorWrapper, createTopicWithoutSubmitResp.transactionId!);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For topic ${topicWithoutSubmit.toString()}
      ], change the submit key to my key`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to update topic: Cannot update submitKey: topic was created without a submitKey',
      );
      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'Failed to update topic: Cannot update submitKey: topic was created without a submitKey',
      );
    },
  );

  it(
    'should update autoRenewAccountId',
    async () => {
      // To set some account as the auto-renew account, it must have the same public key as the operator of the agent
      const secondaryAccountId = await executorWrapper
        .createAccount({ key: executor.privateKey.publicKey, initialBalance: 0 })
        .then(resp => resp.accountId!);

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For topic ${topicId.toString()} set auto renew account id to ${secondaryAccountId.toString()}.`,
          },
        ],
      });

      const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());

      expect(topicDetails.autoRenewAccountId?.toString()).toBe(secondaryAccountId.toString());
    },
  );

  it(
    'should reject updates by an unauthorized operator',
    async () => {
      const secondary = await profile.accounts.acquire({ tier: 'STANDARD' });
      const { client: secondaryClient, wrapper: secondaryWrapper } =
        profile.client.connectAs(secondary);

      const createSecondaryTopicResp = await secondaryWrapper.createTopic({
        autoRenewAccountId: secondary.accountId.toString(),
        isSubmitKey: true,
        adminKey: secondary.privateKey.publicKey as PublicKey,
        submitKey: secondary.privateKey.publicKey as PublicKey,
        topicMemo: 'secondary-topic',
      });
      const topicIdBySecondary = createSecondaryTopicResp.topicId!;

      await waitForMirrorTx(secondaryWrapper, createSecondaryTopicResp.transactionId!);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For topic ${topicIdBySecondary.toString()}
      ], change the admin key to my key`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'You do not have permission to update this topic.',
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'You do not have permission to update this topic.',
      );

      await profile.accounts.release(secondary);
      secondaryClient.close();
    },
  );
});
