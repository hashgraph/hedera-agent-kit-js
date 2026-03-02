import { describe, it, expect, beforeAll } from 'vitest';
import { MaxRecipientsPolicy, Context, AgentMode } from '@/shared';
import { getOperatorClientForTests } from '../../utils';
import { Client } from '@hashgraph/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';

describe('MaxRecipientsPolicy Integration Tests', () => {
  let operatorClient: Client;

  beforeAll(() => {
    operatorClient = getOperatorClientForTests();
  });

  it('should block TRANSFER_HBAR_TOOL if recipients count exceeds limit', async () => {
    const policy = new MaxRecipientsPolicy(1);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = transferHbarTool(context);
    const params = {
      transfers: [
        { accountId: '0.0.1', amount: 0.1 },
        { accountId: '0.0.2', amount: 0.1 },
      ],
    };

    const result = await tool.execute(operatorClient, context, params);

    expect(result.raw.error).toContain('blocked by policy: Max Recipients Policy');
    expect(result.raw.error).toContain('Limits the maximum number of recipients to 1');
  });

  it('should allow TRANSFER_HBAR_TOOL if recipients count is within limit', async () => {
    const policy = new MaxRecipientsPolicy(10);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [policy],
    };

    const tool = transferHbarTool(context);
    const params = {
      transfers: [{ accountId: '0.0.1', amount: 0.1 }],
    };

    const result = await tool.execute(operatorClient, context, params);

    // It should NOT have the policy error
    expect(result.raw.error).not.toBeDefined();
  });
});
