import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Client, PrivateKey, AccountId, TopicId, PublicKey } from '@hashgraph/sdk';
import getTopicMessagesQueryTool from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-messages-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { topicMessagesQueryParameters } from '@/shared/parameter-schemas/consensus.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Get Topic Messages Query Integration Tests', () => {
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
    await executorWrapper.submitMessage({
      topicId: createdTopicId.toString(),
      message: 'Message 3',
    });

    // Wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);
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
