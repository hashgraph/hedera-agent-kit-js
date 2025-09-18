import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey } from '@hashgraph/sdk';
import deleteTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/delete-topic';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

describe('Delete Topic Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    const executorId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 5 })
      .then(r => r.accountId!);
    executorClient = getCustomClient(executorId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
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

    expect(result.humanMessage).toContain('Failed to delete the topic');
    expect(result.raw.status).toBeDefined();
  });
});
