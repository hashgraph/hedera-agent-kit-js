import { beforeAll, describe, it, expect } from 'vitest';
import { Client } from '@hashgraph/sdk';
import { getOperatorClientForTests } from '@hashgraph/hedera-agent-kit-tests';
import { createLangchainTestSetup } from '../../utils';
import { TOOLKIT_OPTIONS } from '../../utils/setup/langchain-test-config';
import { RejectToolPolicy } from '@hashgraph/hedera-agent-kit/policies';
import { coreAccountQueryPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';

const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe('RejectToolPolicy E2E Tests', () => {
    let operatorClient: Client;

    beforeAll(async () => {
        operatorClient = getOperatorClientForTests();
    });

    it('should block the agent from using a rejected tool', async () => {
        const policy = new RejectToolPolicy([GET_HBAR_BALANCE_QUERY_TOOL]);

        const testSetup = await createLangchainTestSetup(
            {
                ...TOOLKIT_OPTIONS,
                hooks: [policy],
            },
            undefined,
            operatorClient,
        );
        const agent = testSetup.agent;

        const input = `What is the HBAR balance of ${operatorClient.operatorAccountId!.toString()}?`;

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
