import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Client, TransactionRecordQuery } from '@hiero-ledger/sdk';
import submitTopicMessageTool from '@/plugins/core-consensus-plugin/tools/consensus/submit-topic-message';
import { AgentMode, type Context } from '@/shared/configuration';
import { getProfile, HederaOperationsWrapper } from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { submitTopicMessageParameters } from '@/shared/parameter-schemas/consensus.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Submit Topic Message Integration Tests', () => {
  const profile = getProfile();
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let context: Context;
  let topicId: string;

  beforeAll(async () => {
    ({ client: operatorClient, wrapper: operatorWrapper } = profile.client.connectAs(
      profile.operator,
    ));
  });

  afterAll(async () => {
    operatorClient?.close();
  });

  beforeEach(async () => {
    // create a topic for each test so tests are isolated
    const created = await operatorWrapper.createTopic({
      autoRenewAccountId: profile.operator.accountId.toString(),
      isSubmitKey: false,
      topicMemo: 'integration-test-topic',
    });
    topicId = created.topicId!.toString();

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: profile.operator.accountId.toString(),
    };
  });

  it('submits a message to an existing topic and returns a transaction id', async () => {
    const tool = submitTopicMessageTool(context);
    const params: z.infer<ReturnType<typeof submitTopicMessageParameters>> = {
      topicId,
      message: 'hello from integration test',
      transactionMemo: 'integration tx memo',
    };

    const result: any = await tool.execute(operatorClient, context, params);

    await waitForMirrorTx(operatorWrapper, result.raw.transactionId); // wait for the message to be processed by mirror node

    const mirrornodeMessages = await operatorWrapper.getTopicMessages(topicId);

    expect(result).toBeDefined();
    expect(result.humanMessage).toContain('Message submitted successfully');
    expect(result.raw).toBeDefined();
    expect(result.raw.transactionId).toBeDefined();
    expect(
      mirrornodeMessages.messages.find(
        m => Buffer.from(m.message, 'base64').toString('utf8') === params.message,
      ),
    ).toBeTruthy();
    const record = await new TransactionRecordQuery()
      .setTransactionId(result.raw.transactionId)
      .execute(operatorClient);
    expect(record.transactionMemo).toBe(params.transactionMemo);
  });

  it('fails with invalid topic id', async () => {
    const tool = submitTopicMessageTool(context);
    const params: z.infer<ReturnType<typeof submitTopicMessageParameters>> = {
      topicId: '0.0.999999999',
      message: 'x',
    };

    const result: any = await tool.execute(operatorClient, context, params);

    if (typeof result === 'string') {
      expect(result).toMatch(/INVALID_TOPIC_ID|NOT_FOUND|INVALID_ARGUMENT/i);
    } else {
      expect(result.raw && result.raw.status).not.toBe('SUCCESS');
    }
  });
});
