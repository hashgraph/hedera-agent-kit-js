import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import deleteTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/delete-topic';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';

describe('Delete Topic Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
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

  it('deletes a topic successfully', async () => {
    // create a topic to be deleted
    const createParams: any = { adminKey: executorClient.operatorPublicKey };
    const createResult: any = await executorWrapper.createTopic(createParams);
    if (!createResult.topicId) throw new Error('Failed to create topic for delete test');

    const params = { topicId: createResult.topicId.toString() };
    const tool = deleteTopicTool(context);
    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Topic with id');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.raw.topicId).toBeDefined();
  });

  it('fails when invalid topicId provided', async () => {
    const params: any = { topicId: 'invalid-topic' };
    const tool = deleteTopicTool(context);
    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Failed to execute Delete Topic');
    expect(result.raw.status).toBeDefined();
  });
});
