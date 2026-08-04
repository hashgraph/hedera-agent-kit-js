import { describe, expect, it } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { z } from 'zod';

import HederaAgentAPI from '../../../src/shared/api';
import type { Tool } from '../../../src/shared/tools';
import { BaseQueryTool, BaseTool, BaseTransactionTool, TOOL_TYPE } from '@/shared';
import type { Context } from '@/shared';

const client = Client.forTestnet();
const tool: Tool = {
  method: 'demo_tool',
  name: 'Demo Tool',
  description: 'A demo tool',
  parameters: z.object({}),
  execute: async () => ({ ok: true }),
};

// Minimal concrete subclasses to test toolType defaults
class ConcreteBaseTool extends BaseTool {
  method = 'base_tool';
  name = 'Base Tool';
  description = 'A base tool';
  parameters = z.object({});
  async normalizeParams(params: any) { return params; }
  async coreAction(_params: any, _context: Context, _client: Client) { return {}; }
}

class ConcreteQueryTool extends BaseQueryTool {
  method = 'query_tool';
  name = 'Query Tool';
  description = 'A query tool';
  parameters = z.object({});
  async normalizeParams(params: any) { return params; }
  async coreAction(_params: any, _context: Context, _client: Client) { return {}; }
}

class ConcreteTransactionTool extends BaseTransactionTool {
  method = 'tx_tool';
  name = 'Transaction Tool';
  description = 'A transaction tool';
  parameters = z.object({});
  async normalizeParams(params: any) { return params; }
  async coreAction(_params: any, _context: Context, _client: Client) { return {}; }
}

describe('HederaAgentAPI', () => {
  it('throws when client is undefined', () => {
    expect(() => new HederaAgentAPI(undefined as unknown as Client)).toThrow(
      'HederaAgentAPI requires a connected Client',
    );
  });

  it('throws when client has no ledgerId', () => {
    const disconnected = {} as unknown as Client;
    expect(() => new HederaAgentAPI(disconnected)).toThrow('Client must be connected to a network');
  });

  it('lists registered tools without exposing executable handlers', () => {
    const api = new HederaAgentAPI(client, {}, [tool]);

    expect(api.listTools()).toEqual([
      {
        method: 'demo_tool',
        name: 'Demo Tool',
        description: 'A demo tool',
        toolType: undefined,
      },
    ]);
  });

  it('returns an empty array when no tools are registered', () => {
    const api = new HederaAgentAPI(client, {});

    expect(api.listTools()).toEqual([]);
  });
});

describe('toolType defaults', () => {
  it('BaseTool defaults to "other"', () => {
    const t = new ConcreteBaseTool();
    expect(t.toolType).toBe(TOOL_TYPE.OTHER);
  });

  it('BaseQueryTool defaults to "query"', () => {
    const t = new ConcreteQueryTool();
    expect(t.toolType).toBe(TOOL_TYPE.QUERY);
  });

  it('BaseTransactionTool defaults to "transaction"', () => {
    const t = new ConcreteTransactionTool();
    expect(t.toolType).toBe(TOOL_TYPE.TRANSACTION);
  });

  it('listTools() surfaces toolType from BaseTool subclass', () => {
    const api = new HederaAgentAPI(client, {}, [new ConcreteQueryTool()]);
    const summary = api.listTools();
    expect(summary[0].toolType).toBe(TOOL_TYPE.QUERY);
  });
});
