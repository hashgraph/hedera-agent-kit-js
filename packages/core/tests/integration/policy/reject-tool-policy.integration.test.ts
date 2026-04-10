import { describe, it, expect, beforeAll } from 'vitest';
import { RejectToolPolicy } from '@/policies/reject-tool-policy';
import { Context, AgentMode } from '@/shared';
import { getOperatorClientForTests } from '@hashgraph/hedera-agent-kit-tests';
import { Client } from '@hashgraph/sdk';
import getHbarBalanceTool from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import { coreAccountQueryPluginToolNames } from '@/plugins';

const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe('reject tool policy integration tests', () => {
  let operatorClient: Client;

  beforeAll(() => {
    operatorClient = getOperatorClientForTests();
  });

  it('should reject tool call if tool is defined in relevantTools', async () => {
    const policy = new RejectToolPolicy([GET_HBAR_BALANCE_QUERY_TOOL]);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = getHbarBalanceTool(context);
    const params = { accountId: operatorClient.operatorAccountId!.toString() };

    await expect(tool.execute(operatorClient, context, params)).resolves.toEqual({
      raw: {
        error: `Failed to get HBAR balance: Action ${GET_HBAR_BALANCE_QUERY_TOOL} blocked by policy: Reject Tool Call (Stops agent from calling predefined tools)`,
      },
      humanMessage: `Failed to get HBAR balance: Action ${GET_HBAR_BALANCE_QUERY_TOOL} blocked by policy: Reject Tool Call (Stops agent from calling predefined tools)`,
    });
  });

  it('should not reject tool call if tool is NOT defined in relevantTools', async () => {
    const policy = new RejectToolPolicy(['some_other_tool']);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = getHbarBalanceTool(context);
    const params = { accountId: operatorClient.operatorAccountId!.toString() };

    const result = await tool.execute(operatorClient, context, params);
    expect(result.raw.error).toBeUndefined();
    expect(result.raw.hbarBalance).toBeDefined();
  });
});
