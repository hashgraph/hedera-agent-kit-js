import { RejectToolPolicy } from '@/shared';
import { describe, it, expect } from 'vitest';
import { Policy } from '@/shared';

describe('RejectToolPolicy', async () => {
  it('should reject a tool call by returning true', async () => {
    const relevantTools = ['toolA', 'toolB'];
    const policy = new RejectToolPolicy(relevantTools);
    const context = {} as any; // mock context
    const params = {} as any;
    const method = 'toolA';

    await expect((policy as Policy).preToolExecutionHook(context, params, method)).rejects.toThrow(
      new RegExp(`Action ${method} blocked by policy: Reject Tool Call ( \\(.+\\))?`),
    );
  });

  it('should not reject a tool call if the tool is not relevant', async () => {
    const relevantTools = ['toolA', 'toolB'];
    const policy = new RejectToolPolicy(relevantTools);
    const context = {} as any; // mock context
    const params = {} as any;
    const method = 'toolC'; // not in relevant tools

    await expect(
      (policy as Policy).preToolExecutionHook(context, params, method),
    ).resolves.toBeUndefined();
  });
});
