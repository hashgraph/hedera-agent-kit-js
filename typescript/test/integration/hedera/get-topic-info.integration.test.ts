import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TopicId, PublicKey } from '@hashgraph/sdk';
import getTopicInfoQueryTool from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-info-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Get Topic Info Query Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let createdTopicId: TopicId;
  let topicAdminKey: PublicKey;

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

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  beforeEach(async () => {
    // Executor creates topic
    topicAdminKey = executorClient.operatorPublicKey!;
    createdTopicId = await executorWrapper
      .createTopic({
        isSubmitKey: false,
        adminKey: topicAdminKey,
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.topicId!);

    // Submit a message to ensure topic exists on mirror
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Hello',
    });

    // Wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  it('should fetch topic info', async () => {
    const tool = getTopicInfoQueryTool(context);

    const result: any = await tool.execute(executorClient, context, {
      topicId: createdTopicId.toString(),
    });

    expect(result.raw).toBeDefined();
    expect(result.raw.topicId).toBe(createdTopicId.toString());
    expect(result.raw.topicInfo.topic_id).toBe(createdTopicId.toString());
    expect(result.humanMessage).toContain('Here are the details for topic');
  });

  it('should fail gracefully for non-existent topic', async () => {
    const tool = getTopicInfoQueryTool(context);

    const result: any = await tool.execute(executorClient, context, {
      topicId: '0.0.999999999',
    });

    expect(result.humanMessage).toContain('Failed to get topic info');
  });

  afterEach(async () => {
    // Cleanup: delete topic
    await executorWrapper.deleteTopic({ topicId: createdTopicId.toString() });
  });

  afterAll(async () => {
    if (executorWrapper && operatorClient) {
      // Delete an executor account and transfer remaining balance back to operator
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });

      executorClient.close();
      operatorClient.close();
    }
  });
});
