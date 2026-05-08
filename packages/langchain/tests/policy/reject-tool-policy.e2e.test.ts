import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { getProfile, type TestAccount } from '@hashgraph/hedera-agent-kit-tests';
import { createLangchainTestSetup } from '@tests/utils';
import { TOOLKIT_OPTIONS } from '@tests/utils';
import { RejectToolPolicy } from '@hashgraph/hedera-agent-kit/policies';
import { coreAccountQueryPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';

const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe('RejectToolPolicy E2E Tests', () => {
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

  it('should block the agent from using a rejected tool', async () => {
    const policy = new RejectToolPolicy([GET_HBAR_BALANCE_QUERY_TOOL]);

    const testSetup = await createLangchainTestSetup(
      {
        ...TOOLKIT_OPTIONS,
        hooks: [policy],
      },
      undefined,
      executorClient,
    );
    const agent = testSetup.agent;

    const input = `What is the HBAR balance of ${executor.accountId.toString()}?`;

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
    expect(parsedResponse[0].parsedData.raw.error).toContain('blocked by policy: Reject Tool Call');
  });
});
