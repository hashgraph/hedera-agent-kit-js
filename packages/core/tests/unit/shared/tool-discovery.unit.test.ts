import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ToolDiscovery } from '@/shared/tool-discovery';
import type { Context } from '@/shared/configuration';
import type { Plugin } from '@/shared/plugin';
import type { Tool } from '@/shared/tools';

const makeTool = (method: string): Tool => ({
  method,
  name: method,
  description: `${method} description`,
  parameters: z.object({}),
  execute: async () => ({}),
});

const makePlugin = (name: string, methods: string[]): Plugin => ({
  name,
  tools: (_context: Context) => methods.map(makeTool),
});

describe('ToolDiscovery readOnly configuration', () => {
  it('keeps query tools when readOnly is enabled', () => {
    const discovery = new ToolDiscovery([
      makePlugin('queries', ['get_account_query_tool', 'get_hbar_balance_query_tool']),
    ]);

    const tools = discovery.getAllTools({}, {readOnly: true});

    expect(tools.map(tool => tool.method)).toEqual([
      'get_account_query_tool',
      'get_hbar_balance_query_tool',
    ]);
  });

  it('rejects write-capable tools when readOnly is enabled', () => {
    const discovery = new ToolDiscovery([
      makePlugin('mixed', ['get_account_query_tool', 'transfer_hbar_tool']),
    ]);

    expect(() => discovery.getAllTools({}, {readOnly: true})).toThrow(
      /transfer_hbar_tool/,
    );
  });

  it('preserves existing behavior when readOnly is disabled', () => {
    const discovery = new ToolDiscovery([
      makePlugin('mixed', ['get_account_query_tool', 'transfer_hbar_tool']),
    ]);

    const tools = discovery.getAllTools({}, {});

    expect(tools.map(tool => tool.method)).toEqual([
      'get_account_query_tool',
      'transfer_hbar_tool',
    ]);
  });
});
