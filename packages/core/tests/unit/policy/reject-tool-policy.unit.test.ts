import { RejectToolPolicy } from '@/policies/reject-tool-policy';
import { describe, it, expect } from 'vitest';
import { AbstractPolicy } from '@/shared';
import { PolicyBlockedError, POLICY_BLOCK_STAGES } from '@/shared/policy-blocked-error';
import { Client } from '@hiero-ledger/sdk';

describe('RejectToolPolicy', async () => {
  it('should block a tool call with a PolicyBlockedError at PRE_TOOL_EXECUTION stage', async () => {
    const relevantTools = ['toolA', 'toolB'];
    const policy = new RejectToolPolicy(relevantTools);
    const context = {} as any; // mock context
    const client = {} as Client; // mock client;
    const params = { context, client } as any;
    const method = 'toolA';

    await expect((policy as AbstractPolicy).preToolExecutionHook(params, method)).rejects.toThrow(
      PolicyBlockedError,
    );

    try {
      await (policy as AbstractPolicy).preToolExecutionHook(params, method);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyBlockedError);
      const e = err as PolicyBlockedError;
      expect(e.policyName).toBe('Reject Tool Call');
      expect(e.toolMethod).toBe(method);
      expect(e.stage).toBe(POLICY_BLOCK_STAGES.PRE_TOOL_EXECUTION);
      expect(e.message).toMatch(new RegExp(`Action ${method} blocked by policy: Reject Tool Call`));
    }
  });

  it('should not reject a tool call if the tool is not relevant', async () => {
    const relevantTools = ['toolA', 'toolB'];
    const policy = new RejectToolPolicy(relevantTools);
    const context = {} as any; // mock context
    const client = {} as Client; // mock client;
    const params = { context, client } as any;
    const method = 'toolC'; // not in relevant tools

    await expect(
      (policy as AbstractPolicy).preToolExecutionHook(params, method),
    ).resolves.toBeUndefined();
  });
});
