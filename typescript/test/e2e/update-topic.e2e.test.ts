import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TopicId } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Update Topic E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let topicId: TopicId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);
  });

  beforeEach(async () => {
    // Create a topic with admin and submit keys so most tests can run updates
    topicId = await executorWrapper
      .createTopic({
        autoRenewAccountId: executorAccountId.toString(),
        isSubmitKey: true,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        submitKey: executorClient.operatorPublicKey! as PublicKey,
        topicMemo: 'initial-topic-memo',
      })
      .then(resp => resp.topicId!);

    // Give mirror node time to index
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  it('should change topic keys using passed values', itWithRetry(async () => {
    const newSubmitKey = PrivateKey.generateED25519().publicKey.toString();

    await agentExecutor.invoke({
      input: `For topic ${topicId.toString()} the submit key to: ${newSubmitKey}.`,
    });

    const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());
    expect((topicDetails.adminKey as PublicKey).toString()).toBe(
      executorClient.operatorPublicKey!.toString(),
    );
    expect((topicDetails.submitKey as PublicKey).toString()).toBe(newSubmitKey);
  }));

  it('should change topic keys using default values (my key)', itWithRetry(async () => {
    await agentExecutor.invoke({
      input: `For topic ${topicId.toString()}, change the submit key to my key and set the topic memo to 'just updated'`,
    });

    const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());
    expect((topicDetails.submitKey as PublicKey).toStringDer()).toBe(
      executorClient.operatorPublicKey!.toStringDer(),
    );
    expect(topicDetails.topicMemo).toBe('just updated');
  }));

  it('should fail due to topic being originally created without submitKey', itWithRetry(async () => {
    // Create a topic without a submitKey
    const topicWithoutSubmit = await executorWrapper
      .createTopic({
        autoRenewAccountId: executorAccountId.toString(),
        isSubmitKey: false,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        topicMemo: 'no-submit',
      })
      .then(resp => resp.topicId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    const queryResult = await agentExecutor.invoke({
      input: `For topic ${topicWithoutSubmit.toString()}, change the submit key to my key`,
    });

    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.humanMessage).toContain(
      'Failed to update topic: Cannot update submitKey: topic was created without a submitKey',
    );
    expect(observation.raw.error).toContain(
      'Failed to update topic: Cannot update submitKey: topic was created without a submitKey',
    );
  }));

  it('should update autoRenewAccountId', itWithRetry(async () => {
    // To set some account as the auto-renew account, it must have the same public key as the operator of the agent
    const secondaryAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey!, initialBalance: 0 })
      .then(resp => resp.accountId!);

    await agentExecutor.invoke({
      input: `For topic ${topicId.toString()} set auto renew account id to ${secondaryAccountId.toString()}.`,
    });

    const topicDetails = await executorWrapper.getTopicInfo(topicId.toString());

    expect(topicDetails.autoRenewAccountId?.toString()).toBe(secondaryAccountId.toString());
  }));

  it('should reject updates by an unauthorized operator', itWithRetry(async () => {
    const secondaryAccountKey = PrivateKey.generateED25519();
    const secondaryAccountId = await executorWrapper
      .createAccount({ key: secondaryAccountKey.publicKey, initialBalance: 10 })
      .then(resp => resp.accountId!);

    const secondaryClient = getCustomClient(secondaryAccountId, secondaryAccountKey);
    const secondaryWrapper = new HederaOperationsWrapper(secondaryClient);
    const topicIdBySecondary = await secondaryWrapper
      .createTopic({
        autoRenewAccountId: secondaryClient.operatorAccountId!.toString(),
        isSubmitKey: true,
        adminKey: secondaryClient.operatorPublicKey! as PublicKey,
        submitKey: secondaryClient.operatorPublicKey! as PublicKey,
        topicMemo: 'secondary-topic',
      })
      .then(resp => resp.topicId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    const queryResult = await agentExecutor.invoke({
      input: `For topic ${topicIdBySecondary.toString()}, change the admin key to my key`,
    });

    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.raw.error).toContain('You do not have permission to update this topic.');
    expect(observation.humanMessage).toContain('You do not have permission to update this topic.');

    await returnHbarsAndDeleteAccount(
      secondaryWrapper,
      secondaryAccountId,
      operatorClient.operatorAccountId!,
    );

    secondaryClient.close();
  }));
});
