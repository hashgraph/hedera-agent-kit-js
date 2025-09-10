import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Client } from '@hashgraph/sdk';
import submitTopicMessageTool from '@/plugins/core-consensus-plugin/tools/consensus/submit-topic-message';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { submitTopicMessageParameters } from '@/shared/parameter-schemas/consensus.zod';
import { wait } from '../../utils/general-util';

describe('Submit Topic Message Integration Tests', () => {
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let context: Context;
  let topicId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);
  });

  afterAll(async () => {
    if (operatorClient) {
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // create a topic for each test so tests are isolated
    const created = await operatorWrapper.createTopic({
      autoRenewAccountId: operatorClient.operatorAccountId!.toString(),
      isSubmitKey: false,
      topicMemo: 'integration-test-topic',
    });
    topicId = created.topicId!.toString();

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: operatorClient.operatorAccountId!.toString(),
    };
  });

  it('submits a message to an existing topic and returns a transaction id', async () => {
    const tool = submitTopicMessageTool(context);
    const params: z.infer<ReturnType<typeof submitTopicMessageParameters>> = {
      topicId,
      message: 'hello from integration test',
    };

    const result: any = await tool.execute(operatorClient, context, params);

    await wait(4000); // wait for the message to be processed by mirror node

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
