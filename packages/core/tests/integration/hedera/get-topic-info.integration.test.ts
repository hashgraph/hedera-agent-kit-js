import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { Client, TopicId, PublicKey } from '@hiero-ledger/sdk';
import getTopicInfoQueryTool from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-info-query';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Get Topic Info Query Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let createdTopicId: TopicId;
  let topicAdminKey: PublicKey;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  beforeEach(async () => {
    // Executor creates topic
    topicAdminKey = executor.privateKey.publicKey;
    const createTopicResp = await executorWrapper.createTopic({
      isSubmitKey: false,
      adminKey: topicAdminKey,
      autoRenewAccountId: executor.accountId.toString(),
    });
    createdTopicId = createTopicResp.topicId!;

    // Submit a message to ensure topic exists on mirror
    const submitResp = await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Hello',
    });

    // Wait for mirror node indexing
    await waitForMirrorTx(executorWrapper, submitResp.transactionId!);
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
    await profile.accounts.release(executor);
    executorClient?.close();
  });
});
