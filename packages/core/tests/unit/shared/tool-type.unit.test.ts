/**
 * Unit tests for the toolType propagation through hook params and the '*' wildcard
 * in AbstractHook / AbstractPolicy.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Client } from '@hiero-ledger/sdk';
import { AbstractHook, type PreToolExecutionParams } from '@/shared/hook';
import { AbstractPolicy } from '@/shared/policy';
import { TOOL_TYPE } from '@/shared/tools';
import { BaseQueryTool } from '@/shared/base-query-tool';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import type { Context } from '@/shared/configuration';

// ---------------------------------------------------------------------------
// Minimal concrete tools for testing
// ---------------------------------------------------------------------------

class TestQueryTool extends BaseQueryTool {
  method = 'test_query_tool';
  name = 'Test Query Tool';
  description = 'A query tool for testing';
  parameters = z.object({});

  async normalizeParams(params: any) {
    return params;
  }

  async coreAction() {
    return { raw: { status: 'SUCCESS' }, humanMessage: 'ok' };
  }

  async shouldSecondaryAction() {
    return false;
  }
}

class TestTransactionTool extends BaseTransactionTool {
  method = 'test_transaction_tool';
  name = 'Test Transaction Tool';
  description = 'A transaction tool for testing';
  parameters = z.object({});

  async normalizeParams(params: any) {
    return params;
  }

  async coreAction() {
    return { raw: { status: 'SUCCESS' }, humanMessage: 'ok' };
  }
}

// ---------------------------------------------------------------------------
// Test: toolType values on base classes
// ---------------------------------------------------------------------------

describe('toolType defaults', () => {
  it('BaseQueryTool reports QUERY', () => {
    const tool = new TestQueryTool();
    expect(tool.toolType).toBe(TOOL_TYPE.QUERY);
  });

  it('BaseTransactionTool reports TRANSACTION', () => {
    const tool = new TestTransactionTool();
    expect(tool.toolType).toBe(TOOL_TYPE.TRANSACTION);
  });
});

// ---------------------------------------------------------------------------
// Test: toolType flows into PreToolExecutionParams
// ---------------------------------------------------------------------------

describe('toolType in hook params', () => {
  it('preToolExecutionHook receives toolType from tool', async () => {
    const capturedParams: PreToolExecutionParams[] = [];

    class SpyHook extends AbstractHook {
      name = 'SpyHook';
      description = undefined;
      relevantTools = ['*'];

      override async preToolExecutionHook(params: PreToolExecutionParams, _method: string) {
        capturedParams.push(params);
      }
    }

    const tool = new TestQueryTool();
    const context: Context = { hooks: [new SpyHook()] };
    const client = Client.forTestnet();

    await tool.execute(client, context, {});

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0].toolType).toBe(TOOL_TYPE.QUERY);
  });

  it('transaction tool passes TRANSACTION toolType to hook', async () => {
    const capturedParams: PreToolExecutionParams[] = [];

    class SpyHook extends AbstractHook {
      name = 'SpyHook';
      description = undefined;
      relevantTools = ['*'];

      override async preToolExecutionHook(params: PreToolExecutionParams, _method: string) {
        capturedParams.push(params);
      }
    }

    const tool = new TestTransactionTool();
    const context: Context = { hooks: [new SpyHook()] };
    const client = Client.forTestnet();

    // coreAction will succeed; secondaryAction is not implemented but BaseTool.execute wraps errors
    await tool.execute(client, context, {});

    expect(capturedParams).toHaveLength(1);
    expect(capturedParams[0].toolType).toBe(TOOL_TYPE.TRANSACTION);
  });
});

// ---------------------------------------------------------------------------
// Test: '*' wildcard in AbstractHook
// ---------------------------------------------------------------------------

describe("'*' wildcard in AbstractHook.relevantTools", () => {
  it("hook with ['*'] fires for any method", async () => {
    let callCount = 0;

    class WildcardHook extends AbstractHook {
      name = 'WildcardHook';
      description = undefined;
      relevantTools = ['*'];

      override async preToolExecutionHook(_params: PreToolExecutionParams, _method: string) {
        callCount++;
      }
    }

    const tool = new TestQueryTool();
    const context: Context = { hooks: [new WildcardHook()] };

    await tool.execute(Client.forTestnet(), context, {});
    expect(callCount).toBe(1);
  });

  it('hook without matching method is skipped when using appliesToMethod guard', async () => {
    // Hooks must call this.appliesToMethod(method) themselves in their override —
    // this mirrors the pattern shown in the Template for New Hook docs.
    let callCount = 0;

    class SpecificHook extends AbstractHook {
      name = 'SpecificHook';
      description = undefined;
      relevantTools = ['some_other_tool'];

      override async preToolExecutionHook(_params: PreToolExecutionParams, method: string) {
        if (!this.appliesToMethod(method)) return; // guard is the hook author's responsibility
        callCount++;
      }
    }

    const tool = new TestQueryTool(); // method = 'test_query_tool'
    const context: Context = { hooks: [new SpecificHook()] };

    await tool.execute(Client.forTestnet(), context, {});
    expect(callCount).toBe(0);
  });

  it("appliesToMethod returns false for a non-matching method and true for '*'", () => {
    class TestHook extends AbstractHook {
      name = 'TestHook';
      description = undefined;
      relevantTools = ['tool_a', 'tool_b'];
    }

    const hook = new TestHook();
    expect(hook['appliesToMethod']('tool_a')).toBe(true);
    expect(hook['appliesToMethod']('tool_z')).toBe(false);

    hook.relevantTools = ['*'];
    expect(hook['appliesToMethod']('tool_z')).toBe(true);
    expect(hook['appliesToMethod']('anything')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: ReadOnlyPolicy — blocks transaction tools, allows query tools
// ---------------------------------------------------------------------------

describe('ReadOnlyPolicy pattern', () => {
  class ReadOnlyPolicy extends AbstractPolicy {
    name = 'ReadOnlyPolicy';
    description = 'Blocks any non-query tool';
    relevantTools = ['*'];

    protected shouldBlockPreToolExecution(params: PreToolExecutionParams): boolean {
      return params.toolType !== TOOL_TYPE.QUERY;
    }
  }

  it('allows query tool to execute without throwing', async () => {
    const tool = new TestQueryTool();
    const context: Context = { hooks: [new ReadOnlyPolicy()] };

    await expect(tool.execute(Client.forTestnet(), context, {})).resolves.not.toThrow();
  });

  it('blocks transaction tool and wraps error in result (BaseTool.handleError)', async () => {
    const tool = new TestTransactionTool();
    const context: Context = { hooks: [new ReadOnlyPolicy()] };

    // BaseTool.execute catches errors and returns { raw: { status: 'ERROR', error }, humanMessage }
    const result = await tool.execute(Client.forTestnet(), context, {});
    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.error).toMatch(/blocked by policy: ReadOnlyPolicy/);
  });
});
