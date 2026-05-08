import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { Client, TopicId, PublicKey } from '@hiero-ledger/sdk';
import getTopicMessagesQueryTool from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-messages-query';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { topicMessagesQueryParameters } from '@/shared/parameter-schemas/consensus.zod';
import { wait, waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Get Topic Messages Query Integration Tests', () => {
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

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
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

    // Submit some messages to the topic
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Message 1',
    });
    await wait(1000);
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Message 2',
    });
    await wait(1000);
    const submit3Resp = await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Message 3',
    });

    // Wait for mirror node indexing
    await waitForMirrorTx(executorWrapper, submit3Resp.transactionId!);
  });

  it('should fetch all topic messages', async () => {
    const tool = getTopicMessagesQueryTool(context);

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: createdTopicId.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw).toBeDefined();
    expect(result.raw.messages.length).toBe(3);
    expect(result.raw.messages.reverse().map((m: any) => m.message)).toEqual([
      'Message 1',
      'Message 2',
      'Message 3',
    ]);
    expect(result.humanMessage).toContain('Messages for topic');
    expect(result.humanMessage).toContain('Message 1');
  });

  it('should fetch messages between specific timestamps', async () => {
    const tool = getTopicMessagesQueryTool(context);

    // Fetch all messages first to get timestamps
    const allMessages = await tool.execute(executorClient, context, {
      topicId: createdTopicId.toString(),
    });
    const message2Timestamp = allMessages.raw.messages[1].consensus_timestamp;

    const startTime = new Date(Number(message2Timestamp.split('.')[0]) * 1000).toISOString();

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: createdTopicId.toString(),
      startTime,
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.messages.length).toBe(2); // Message 2 and Message 3
    expect(result.raw.messages.reverse().map((m: any) => m.message)).toEqual([
      'Message 2',
      'Message 3',
    ]);
  });

  it('should fail gracefully for non-existent topic', async () => {
    const tool = getTopicMessagesQueryTool(context);

    const params: z.infer<ReturnType<typeof topicMessagesQueryParameters>> = {
      topicId: '0.0.999999999',
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('No messages found for topic');
  });

  afterEach(async () => {
    // Cleanup: delete topic
    await executorWrapper.deleteTopic({ topicId: createdTopicId.toString() });
  });
});
