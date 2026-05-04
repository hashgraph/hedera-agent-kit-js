import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TopicCreateTransaction } from '@hiero-ledger/sdk';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
} from '@hashgraph/hedera-agent-kit-tests';
import { createLangchainTestSetup, type LangchainTestSetup, TOOLKIT_OPTIONS } from '../../utils';
import { HcsAuditTrailHook } from '@hashgraph/hedera-agent-kit/hooks';
import { TRANSFER_HBAR_TOOL } from '@hashgraph/hedera-agent-kit/plugins';

describe('HcsAuditTrailHook E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let recipient: TestAccount;
  let topicId: string;
  let testSetup: LangchainTestSetup;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // create recipient account for testing
    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });

    // Create a temporary topic for testing
    const tx = await new TopicCreateTransaction().execute(executorClient);
    const receipt = await tx.getReceipt(executorClient);
    topicId = receipt.topicId!.toString();

    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, executorClient);

    testSetup = await createLangchainTestSetup(
      {
        ...TOOLKIT_OPTIONS,
        tools: [TRANSFER_HBAR_TOOL],
        hooks: [hook],
      },
      undefined,
      executorClient,
    );
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it('should log tool execution to HCS successfully via Langchain agent', async () => {
    const agent = testSetup.agent;
    const amount = 0.0001;
    const input = `Transfer ${amount} HBAR to ${recipient.accountId.toString()}`;

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
    const mirrorNodeMessages = await executorWrapper.getTopicMessages(topicId);
    console.log('mirrorNodeMessages', mirrorNodeMessages);

    expect(mirrorNodeMessages.messages.length).toBeGreaterThan(0);

    const lastMessage64 =
      mirrorNodeMessages.messages[mirrorNodeMessages.messages.length - 1].message;
    const lastMessage = Buffer.from(lastMessage64, 'base64').toString('utf-8');

    expect(lastMessage).toContain(`Agent executed tool ${TRANSFER_HBAR_TOOL}`);
    expect(lastMessage).toContain(recipient.accountId.toString());
  });
});
