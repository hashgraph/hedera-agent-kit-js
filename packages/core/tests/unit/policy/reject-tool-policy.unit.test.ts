import { RejectToolPolicy } from '@/policies/reject-tool-policy';
import { describe, it, expect } from 'vitest';
import { AbstractPolicy } from '@/shared';
import { Client } from '@hiero-ledger/sdk';

describe('RejectToolPolicy', async () => {
  it('should reject a tool call by returning true', async () => {
    const relevantTools = ['toolA', 'toolB'];
    const policy = new RejectToolPolicy(relevantTools);
    const context = {} as any; // mock context
    const client = {} as Client; // mock client;
    const params = { context, client } as any;
    const method = 'toolA';

    await expect((policy as AbstractPolicy).preToolExecutionHook(params, method)).rejects.toThrow(
      new RegExp(`Action ${method} blocked by policy: Reject Tool Call ( \\(.+\\))?`),
    );
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
