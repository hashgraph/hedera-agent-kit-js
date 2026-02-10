import { describe, expect, test, vi } from 'vitest';
import { BaseTool } from '@/shared';
import { Policy } from '@/shared';
import { Context } from '@/shared';
import { z } from 'zod';
import { Client } from '@hashgraph/sdk';

// Enum for testing to specify which hook point should block
enum BlockAt {
  PreToolExecution = 'PreToolExecution',
  PostParamsNormalization = 'PostParamsNormalization',
  PostCoreAction = 'PostCoreAction',
  PostSecondaryAction = 'PostSecondaryAction',
}

// Mock Tool
class MockTool extends BaseTool {
  method = 'mock_tool';
  name = 'Mock Tool';
  description = 'A mock tool for testing policies';
  parameters = z.object({ foo: z.string() });

  async normalizeParams(params: any, _context: Context, _client: Client) {
    return { ...params, normalized: true };
  }
  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return { ...normalisedParams, action: 'done' };
  }
  async secondaryAction(request: any, _client: Client, _context: Context) {
    return { ...request, submit: 'done' };
  }
}

// Mock Policy
class MockPolicy extends Policy {
  description = 'Test policy';
  name = 'Test Policy';
  relevantTools = ['mock_tool'];
  // Spies for validation methods
  validatePreToolExecution = vi.fn().mockReturnValue(false);
  validatePostParamsNormalization = vi.fn().mockReturnValue(false);
  validatePostCoreAction = vi.fn().mockReturnValue(false);
  validatePostSecondaryAction = vi.fn().mockReturnValue(false);

  constructor(shouldBlockAt?: BlockAt) {
    super();
    if (shouldBlockAt === BlockAt.PreToolExecution) {
      this.validatePreToolExecution.mockReturnValue(true);
    } else if (shouldBlockAt === BlockAt.PostParamsNormalization) {
      this.validatePostParamsNormalization.mockReturnValue(true);
    } else if (shouldBlockAt === BlockAt.PostCoreAction) {
      this.validatePostCoreAction.mockReturnValue(true);
    } else if (shouldBlockAt === BlockAt.PostSecondaryAction) {
      this.validatePostSecondaryAction.mockReturnValue(true);
    }
  }

  protected shouldBlockPreToolExecution(context: Context, params: any): boolean {
    return this.validatePreToolExecution(context, params);
  }

  protected shouldBlockPostParamsNormalization(context: Context, params: any): boolean {
    return this.validatePostParamsNormalization(context, params);
  }

  protected shouldBlockPostCoreAction(context: Context, params: any): boolean {
    return this.validatePostCoreAction(context, params);
  }

  protected shouldBlockPostSecondaryAction(context: Context, params: any): boolean {
    return this.validatePostSecondaryAction(context, params);
  }
}

describe('Policy Hooks', () => {
  const client = {} as Client; // Mock client

  test('executes policies at PreToolExecution point', async () => {
    const policy = new MockPolicy(BlockAt.PreToolExecution);
    const context: Context = { hooks: [policy] };
    const tool = new MockTool();

    const result = await tool.execute(client, context, { foo: 'bar' });
    expect(result.raw.error).toContain('Action blocked by policy: Test Policy');

    // Check strict object structure
    expect(policy.validatePreToolExecution).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        context,
        rawParams: { foo: 'bar' },
      }),
    );
  });

  test('executes policies at PostParamsNormalization point', async () => {
    const policy = new MockPolicy(BlockAt.PostParamsNormalization);
    const context: Context = { hooks: [policy] };
    const tool = new MockTool();

    const result = await tool.execute(client, context, { foo: 'bar' });
    expect(result.raw.error).toContain('Action blocked by policy: Test Policy');

    expect(policy.validatePostParamsNormalization).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        context,
        rawParams: { foo: 'bar' },
        normalisedParams: { foo: 'bar', normalized: true },
      }),
    );
  });

  test('executes policies at PostCoreAction point', async () => {
    const policy = new MockPolicy(BlockAt.PostCoreAction);
    const context: Context = { hooks: [policy] };
    const tool = new MockTool();

    const result = await tool.execute(client, context, { foo: 'bar' });
    expect(result.raw.error).toContain('Action blocked by policy: Test Policy');

    expect(policy.validatePostCoreAction).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        context,
        rawParams: { foo: 'bar' },
        normalisedParams: { foo: 'bar', normalized: true },
        coreActionResult: { foo: 'bar', normalized: true, action: 'done' },
      }),
    );
  });

  test('executes policies at PostSecondaryAction point', async () => {
    const policy = new MockPolicy(BlockAt.PostSecondaryAction);
    const context: Context = { hooks: [policy] };
    const tool = new MockTool();

    const result = await tool.execute(client, context, { foo: 'bar' });
    expect(result.raw.error).toContain('Action blocked by policy: Test Policy');

    expect(policy.validatePostSecondaryAction).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        context,
        rawParams: { foo: 'bar' },
        normalisedParams: { foo: 'bar', normalized: true },
        coreActionResult: { foo: 'bar', normalized: true, action: 'done' },
        toolResult: { foo: 'bar', normalized: true, action: 'done', submit: 'done' },
      }),
    );
  });

  test('does not block if policy returns false', async () => {
    const policy = new MockPolicy(); // No blocking
    const context: Context = { hooks: [policy] };
    const tool = new MockTool();

    const result = await tool.execute(client, context, { foo: 'bar' });

    // Expect successful result structure
    expect(result).toEqual({ foo: 'bar', normalized: true, action: 'done', submit: 'done' });

    // Verify all hooks were called
    expect(policy.validatePreToolExecution).toHaveBeenCalled();
    expect(policy.validatePostParamsNormalization).toHaveBeenCalled();
    expect(policy.validatePostCoreAction).toHaveBeenCalled();
    expect(policy.validatePostSecondaryAction).toHaveBeenCalled();
  });
});
