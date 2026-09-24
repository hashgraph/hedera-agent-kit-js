import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RejectToolPolicy } from '@/policies/reject-tool-policy';
import { Context, AgentMode } from '@/shared';
import { getProfile } from '@hashgraph/hedera-agent-kit-tests';
import { Client } from '@hiero-ledger/sdk';
import getHbarBalanceTool from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import { coreAccountQueryPluginToolNames } from '@/plugins';

const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe('reject tool policy integration tests', () => {
  const profile = getProfile();
  let operatorClient: Client;

  beforeAll(() => {
    ({ client: operatorClient } = profile.client.connectAs(profile.operator));
  });

  afterAll(() => {
    operatorClient?.close();
  });

  it('should reject tool call if tool is defined in relevantTools', async () => {
    const policy = new RejectToolPolicy([GET_HBAR_BALANCE_QUERY_TOOL]);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = getHbarBalanceTool(context);
    const params = { accountId: profile.operator.accountId.toString() };

    const result = await tool.execute(operatorClient, context, params);

    // Prose message is preserved for the LLM loop
    const expectedMessage = `Failed to execute Get HBAR Balance: Action ${GET_HBAR_BALANCE_QUERY_TOOL} blocked by policy: Reject Tool Call (Stops agent from calling predefined tools)`;
    expect(result.raw.error).toBe(expectedMessage);
    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.errorCode).toBe('POLICY_BLOCKED');
    expect(result.humanMessage).toBe(expectedMessage);

    // Structured policy block info for programmatic loops
    expect(result.raw.policyBlock).toMatchObject({
      code: 'POLICY_BLOCKED',
      policyName: 'Reject Tool Call',
      toolMethod: GET_HBAR_BALANCE_QUERY_TOOL,
      stage: 'pre_tool_execution',
    });
  });

  it('should not reject tool call if tool is NOT defined in relevantTools', async () => {
    const policy = new RejectToolPolicy(['some_other_tool']);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = getHbarBalanceTool(context);
    const params = { accountId: profile.operator.accountId.toString() };

    const result = await tool.execute(operatorClient, context, params);
    expect(result.raw.error).toBeUndefined();
    expect(result.raw.hbarBalance).toBeDefined();
  });
});
