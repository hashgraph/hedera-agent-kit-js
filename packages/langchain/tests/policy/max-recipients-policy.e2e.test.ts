import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { getProfile, type TestAccount } from '@hashgraph/hedera-agent-kit-tests';
import { createLangchainTestSetup } from '@tests/utils';
import { TOOLKIT_OPTIONS } from '@tests/utils';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';

describe('MaxRecipientsPolicy E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient } = profile.client.connectAs(executor));
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('should block the agent if it tries to send HBAR to more than allowed recipients', async () => {
    // Set the limit to 1
    const policy = new MaxRecipientsPolicy(1);

    const testSetup = await createLangchainTestSetup(
      {
        ...TOOLKIT_OPTIONS,
        hooks: [policy],
      },
      undefined,
      executorClient,
    );
    const agent = testSetup.agent;

    // Prompt for 2 recipients
    const input = `Transfer 0.1 HBAR to 0.0.1 and 0.1 HBAR to 0.0.2 from my account.`;

    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const parsedResponse = testSetup.responseParser.parseNewToolMessages(result);

    expect(parsedResponse.length).toBeGreaterThan(0);
    // Check if the policy blocked any tool call
    const policyError = parsedResponse.find(
      (tool: any) =>
        tool.parsedData.raw.error &&
        tool.parsedData.raw.error.includes('blocked by policy: Max Recipients Policy'),
    );

    expect(policyError).toBeDefined();
    expect(policyError?.parsedData.raw.error).toContain(
      'Limits the maximum number of recipients to 1',
    );

    testSetup.cleanup();
  });
});
