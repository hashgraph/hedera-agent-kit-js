import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TopicCreateTransaction } from '@hashgraph/sdk';
import {
  createLangchainTestSetup,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../../utils';
import { HcsAuditTrailHook } from '@/shared/hooks/hcs-audit-trail-hook';
import { TRANSFER_HBAR_TOOL } from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { TOOLKIT_OPTIONS } from '../../utils/setup/langchain-test-config';

describe('HcsAuditTrailHook E2E Tests', () => {
  let operatorClient: Client;
  let topicId: string;
  let testSetup: LangchainTestSetup;
  let operatorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create a temporary topic for testing
    const tx = await new TopicCreateTransaction().execute(operatorClient);
    const receipt = await tx.getReceipt(operatorClient);
    topicId = receipt.topicId!.toString();

    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);

    testSetup = await createLangchainTestSetup(
      {
        ...TOOLKIT_OPTIONS,
        tools: [TRANSFER_HBAR_TOOL],
        hooks: [hook],
      },
      undefined,
      operatorClient,
    );
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it('should log tool execution to HCS successfully via Langchain agent', async () => {
    const agent = testSetup.agent;
    const recipientId = operatorClient.operatorAccountId!.toString();
    const amount = 0.0001;
    const input = `Transfer ${amount} HBAR to ${recipientId}`;

    await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    // Wait for the mirror node to index the HCS message
    await wait(MIRROR_NODE_WAITING_TIME);

    // Verify that the message was published to the HCS topic
    const mirrorNodeMessages = await operatorWrapper.getTopicMessages(topicId);

    expect(mirrorNodeMessages.messages.length).toBeGreaterThan(0);

    const lastMessage64 =
      mirrorNodeMessages.messages[mirrorNodeMessages.messages.length - 1].message;
    const lastMessage = Buffer.from(lastMessage64, 'base64').toString('utf-8');
    console.log(lastMessage);

    expect(lastMessage).toContain(`Agent executed tool ${TRANSFER_HBAR_TOOL}`);
    expect(lastMessage).toContain(recipientId);
  });
});
