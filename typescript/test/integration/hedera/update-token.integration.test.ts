import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AccountId, Client, PrivateKey, TopicId } from '@hashgraph/sdk';
import updateTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/update-topic';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Update Topic Integration Tests', () => {
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let executorAccountKey: PrivateKey;
  let executorAccountId: AccountId;
  let context: Context;
  let topicId: TopicId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: 25,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  beforeEach(async () => {
    const createResult = await executorWrapper.createTopic({
      adminKey: executorClient.operatorPublicKey!,
      submitKey: executorClient.operatorPublicKey!,
      topicMemo: 'Initial topic memo',
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      isSubmitKey: true,
    });

    topicId = createResult.topicId!;
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterEach(async () => {
    if (topicId) {
      try {
        await executorWrapper.deleteTopic({ topicId: topicId.toString() });
      } catch (e) {
        console.warn(`Failed to delete topic ${topicId}: ${e}`);
      }
    }
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  it('updates topic memo', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), topicMemo: 'Updated memo via integration test' };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Topic successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.topicMemo).toBe('Updated memo via integration test');
  });

  it('updates submitKey to operator key', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: true };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Topic successfully updated.');

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.submitKey?.toString()).toBe(executorClient.operatorPublicKey!.toString());
  });

  it('updates submitKey to a new public key', async () => {
    const newKey = PrivateKey.generateED25519().publicKey;
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: newKey.toString() };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Topic successfully updated.');

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.submitKey?.toString()).toBe(newKey.toString());
  });

  it('updates autoRenewAccountId, autoRenewPeriod, and extends expirationTime', async () => {
    const tool = updateTopicTool(context);

    // Fetch current topic info
    const currentInfo = await executorWrapper.getTopicInfo(topicId.toString());
    expect(currentInfo?.expirationTime).not.toBeNull();

    // Extend expiration by 48 hours from the current expiration
    const currentExpirationMillis =
      currentInfo!.expirationTime!.seconds.toNumber() * 1000 +
      Math.floor(currentInfo!.expirationTime!.nanos.toNumber() / 1e6);
    const newExpirationDate = new Date(currentExpirationMillis + 48 * 3600 * 1000); // +48h
    const newExpirationISO = newExpirationDate.toISOString();

    const newAutoRenewPeriod = 30 * 24 * 3600; // 30 days

    const params = {
      topicId: topicId.toString(),
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      autoRenewPeriod: newAutoRenewPeriod,
      expirationTime: newExpirationDate,
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Topic successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const updatedInfo = await executorWrapper.getTopicInfo(topicId.toString());
    expect(updatedInfo?.autoRenewAccountId?.toString()).toBe(
      executorClient.operatorAccountId!.toString(),
    );
    expect(updatedInfo?.autoRenewPeriod?.seconds.toString()).toBe(newAutoRenewPeriod.toString());

    const expirationTimeMillis =
      updatedInfo!.expirationTime!.seconds.toNumber() * 1000 +
      Math.floor(updatedInfo!.expirationTime!.nanos.toNumber() / 1e6);
    expect(new Date(expirationTimeMillis).toISOString()).toBe(newExpirationISO);
  });

  it('fails if trying to set submitKey when topic was created without one', async () => {
    // Delete the existing topic and recreate without a submitKey
    await executorWrapper.deleteTopic({ topicId: topicId.toString() });
    const createResult = await executorWrapper.createTopic({
      adminKey: executorClient.operatorPublicKey!,
      topicMemo: 'No submitKey topic',
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      isSubmitKey: true,
    });
    topicId = createResult.topicId!;
    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: true };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to update topic: Cannot update submitKey');
  });

  it('fails with invalid topic ID', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: '0.0.999999999', topicMemo: 'Invalid topic' };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to update topic:');
  });
});
