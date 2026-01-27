import { describe, expect, test, vi } from 'vitest';
import { BaseTool } from '@/shared/tools';
import { ToolExecutionPoint, Policy } from '@/shared/policy';
import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { Client } from '@hashgraph/sdk';

// Mock Tool
class MockTool extends BaseTool {
    method = 'mock_tool';
    name = 'Mock Tool';
    description = 'A mock tool for testing policies';
    parameters = z.object({ foo: z.string() });

    async normalizeParams(params: any, context: Context, client: Client) {
        return params;
    }
    async action(normalisedParams: any, context: Context, client: Client) {
        return { ...normalisedParams, action: 'done' };
    }
    async submit(request: any, client: Client, context: Context) {
        return { ...request, submit: 'done' };
    }
}

describe('Policy Hooks', () => {
    const client = {} as Client; // Mock client

    test('executes policies at PreToolExecution point', async () => {
        const policy: Policy = {
            name: 'Test Policy',
            relevantTools: ['mock_tool'],
            affectedPoints: [ToolExecutionPoint.PreToolExecution],
            shouldBlock: vi.fn().mockReturnValue(true),
        };
        const context: Context = { policies: [policy] };
        const tool = new MockTool(context);

        const result = await tool.execute(client, context, { foo: 'bar' });
        expect(result.raw.error).toContain('Action blocked by policy: Test Policy');
        expect(policy.shouldBlock).toHaveBeenCalledWith({ foo: 'bar' });
    });

    test('executes policies at PostParamsNormalization point', async () => {
        const policy: Policy = {
            name: 'Test Policy',
            relevantTools: ['mock_tool'],
            affectedPoints: [ToolExecutionPoint.PostParamsNormalization],
            shouldBlock: vi.fn().mockReturnValue(true),
        };
        const context: Context = { policies: [policy] };
        const tool = new MockTool(context);

        const result = await tool.execute(client, context, { foo: 'bar' });
        expect(result.raw.error).toContain('Action blocked by policy: Test Policy');
        expect(policy.shouldBlock).toHaveBeenCalledWith({ foo: 'bar' });
    });

    test('executes policies at PostAction point', async () => {
        const policy: Policy = {
            name: 'Test Policy',
            relevantTools: ['mock_tool'],
            affectedPoints: [ToolExecutionPoint.PostAction],
            shouldBlock: vi.fn().mockReturnValue(true),
        };
        const context: Context = { policies: [policy] };
        const tool = new MockTool(context);

        // Should fail at PostAction
        const result = await tool.execute(client, context, { foo: 'bar' });
        expect(result.raw.error).toContain('Action blocked by policy: Test Policy');
        expect(policy.shouldBlock).toHaveBeenCalledWith({ foo: 'bar', action: 'done' });
    });

    test('executes policies at PostSubmit point', async () => {
        const policy: Policy = {
            name: 'Test Policy',
            relevantTools: ['mock_tool'],
            affectedPoints: [ToolExecutionPoint.PostSubmit],
            shouldBlock: vi.fn().mockReturnValue(true),
        };
        const context: Context = { policies: [policy] };
        const tool = new MockTool(context);

        const result = await tool.execute(client, context, { foo: 'bar' });
        expect(result.raw.error).toContain('Action blocked by policy: Test Policy');
        expect(policy.shouldBlock).toHaveBeenCalledWith({ foo: 'bar', action: 'done', submit: 'done' });
    });

    test('does not block if policy returns false', async () => {
        const policy: Policy = {
            name: 'Test Policy',
            relevantTools: ['mock_tool'],
            affectedPoints: [ToolExecutionPoint.PreToolExecution],
            shouldBlock: vi.fn().mockReturnValue(false),
        };
        const context: Context = { policies: [policy] };
        const tool = new MockTool(context);

        const result = await tool.execute(client, context, { foo: 'bar' });
        expect(result).toEqual({ foo: 'bar', action: 'done', submit: 'done' });
        expect(policy.shouldBlock).toHaveBeenCalled();
    });
});
