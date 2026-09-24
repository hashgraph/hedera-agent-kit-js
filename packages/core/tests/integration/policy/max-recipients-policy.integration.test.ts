import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MaxRecipientsPolicy } from '@/policies/max-recipients-policy';
import { Context, AgentMode } from '@/shared';
import { classifyToolResult, isPolicyBlockedToolResult } from '@/shared/utils/default-tool-output-parsing';
import { getProfile } from '@hashgraph/hedera-agent-kit-tests';
import { Client } from '@hiero-ledger/sdk';
import transferHbarTool from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { TRANSFER_HBAR_TOOL } from '@/plugins/core-account-plugin/tools/account/transfer-hbar';

describe('MaxRecipientsPolicy Integration Tests', () => {
  const profile = getProfile();
  let operatorClient: Client;

  beforeAll(() => {
    ({ client: operatorClient } = profile.client.connectAs(profile.operator));
  });

  afterAll(() => {
    operatorClient?.close();
  });

  describe('when recipients exceed the cap (throw-with-details path)', () => {
    it('preserves the prose humanMessage for the LLM loop', async () => {
      const policy = new MaxRecipientsPolicy(1);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [
          { accountId: '0.0.1', amount: 0.1 },
          { accountId: '0.0.2', amount: 0.1 },
        ],
      };

      const result = await tool.execute(operatorClient, context, params);

      expect(result.humanMessage).toContain('blocked by policy: Max Recipients Policy');
      expect(result.humanMessage).toContain('Limits the maximum number of recipients to 1');
      expect(result.raw.status).toBe('ERROR');
    });

    it('sets errorCode POLICY_BLOCKED on raw', async () => {
      const policy = new MaxRecipientsPolicy(1);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [
          { accountId: '0.0.1', amount: 0.1 },
          { accountId: '0.0.2', amount: 0.1 },
        ],
      };

      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.errorCode).toBe('POLICY_BLOCKED');
    });

    it('populates raw.policyBlock with structured fields including details', async () => {
      const policy = new MaxRecipientsPolicy(1);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [
          { accountId: '0.0.1', amount: 0.1 },
          { accountId: '0.0.2', amount: 0.1 },
        ],
      };

      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.policyBlock).toMatchObject({
        code: 'POLICY_BLOCKED',
        policyName: 'Max Recipients Policy',
        toolMethod: TRANSFER_HBAR_TOOL,
        stage: 'post_params_normalization',
        description: 'Limits the maximum number of recipients to 1',
        details: { recipientCount: 2, maxRecipients: 1 },
      });
    });

    it('classifyToolResult returns kind: policy_block with typed fields', async () => {
      const policy = new MaxRecipientsPolicy(1);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [
          { accountId: '0.0.1', amount: 0.1 },
          { accountId: '0.0.2', amount: 0.1 },
        ],
      };

      const result = await tool.execute(operatorClient, context, params);
      const classified = classifyToolResult(result);

      expect(classified.kind).toBe('policy_block');
      if (classified.kind === 'policy_block') {
        expect(classified.policyName).toBe('Max Recipients Policy');
        expect(classified.stage).toBe('post_params_normalization');
        expect(classified.details).toEqual({ recipientCount: 2, maxRecipients: 1 });
      }
    });

    it('isPolicyBlockedToolResult returns true for a blocked result', async () => {
      const policy = new MaxRecipientsPolicy(1);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [
          { accountId: '0.0.1', amount: 0.1 },
          { accountId: '0.0.2', amount: 0.1 },
        ],
      };

      const result = await tool.execute(operatorClient, context, params);

      expect(isPolicyBlockedToolResult(result)).toBe(true);
    });
  });

  describe('when recipients are within the cap', () => {
    it('allows the tool to proceed and returns no policy block', async () => {
      const policy = new MaxRecipientsPolicy(10);
      const context: Context = { mode: AgentMode.AUTONOMOUS, hooks: [policy] };
      const tool = transferHbarTool(context);
      const params = {
        transfers: [{ accountId: '0.0.1', amount: 0.1 }],
      };

      const result = await tool.execute(operatorClient, context, params);

      expect(result.raw.errorCode).toBeUndefined();
      expect(result.raw.policyBlock).toBeUndefined();
      expect(isPolicyBlockedToolResult(result)).toBe(false);
    });
  });
});
