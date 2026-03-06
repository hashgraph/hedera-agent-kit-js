import { beforeAll, describe, it, expect } from 'vitest';
import { Client } from '@hashgraph/sdk';
import { createLangchainTestSetup, getOperatorClientForTests } from '../../utils';
import { MaxRecipientsPolicy } from '@/shared';
import { TOOLKIT_OPTIONS } from '../../utils/setup/langchain-test-config';

describe('MaxRecipientsPolicy E2E Tests', () => {
  let operatorClient: Client;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
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
      operatorClient,
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
      tool =>
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
