/**
 * Guard: every core tool's LLM-facing parameter schema must be convertible to JSON Schema.
 *
 * Each framework adapter hands `tool.parameters` to zod 4's `toJSONSchema` with its own options,
 * and none of them tolerates unrepresentable types (`z.date()`, `z.instanceof()`, `z.custom()`,
 * `z.bigint()`, ...) — conversion throws at tool registration time. The option sets below mirror
 * what each adapter's underlying library passes; keep them in sync when bumping those libraries.
 *
 * Pipes/transforms (`z.preprocess`, `.transform`, `.pipe`) are rejected too: zod itself can render
 * them, but @langchain/core first strips them down to their input side (a bare transform), which
 * then throws "Transforms cannot be represented in JSON Schema".
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { allCorePlugins } from '@/plugins';
import { AgentMode, type Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';

type JSONSchemaParams = NonNullable<Parameters<typeof z.toJSONSchema>[1]>;

const ADAPTER_CONVERSIONS: Record<string, JSONSchemaParams> = {
  // ai (@ai-sdk/provider-utils `zodSchema`) — used by `tool({ inputSchema })`
  'ai-sdk': { target: 'draft-7', io: 'input', reused: 'inline' },
  // @langchain/core `toJsonSchema` — used by StructuredTool; zod defaults
  langchain: {},
  // @modelcontextprotocol/sdk `toJsonSchemaCompat` — used by `registerTool({ inputSchema })`
  mcp: { target: 'draft-7', io: 'input' },
  // @google/adk `zodObjectToSchema` — used by FunctionTool
  adk: { target: 'openapi-3.0', io: 'input' },
  // packages/elizaos/src/utils/extraction.ts
  elizaos: { io: 'input' },
};

const FORBIDDEN_TYPES = new Set(['pipe', 'transform']);

/** Converts like an adapter would, additionally failing on pipes/transforms. */
const toAdapterJSONSchema = (schema: z.ZodType, params: JSONSchemaParams) =>
  z.toJSONSchema(schema, {
    ...params,
    override: ctx => {
      const type = ctx.zodSchema._zod.def.type;
      if (FORBIDDEN_TYPES.has(type)) {
        throw new Error(`LLM-facing schemas must not contain a ${type} (stripped by LangChain)`);
      }
    },
  });

const CONTEXTS: Record<string, Context> = {
  empty: {},
  autonomous: { mode: AgentMode.AUTONOMOUS, accountId: '0.0.1001' },
  returnBytes: { mode: AgentMode.RETURN_BYTES, accountId: '0.0.1001' },
};

const toolCases = Object.entries(CONTEXTS).flatMap(([contextName, context]) =>
  allCorePlugins.flatMap(plugin =>
    plugin.tools(context).map((tool: Tool) => ({ contextName, method: tool.method, tool })),
  ),
);

describe('core tool parameter schemas -> JSON Schema', () => {
  it('discovers core tools', () => {
    expect(toolCases.length).toBeGreaterThan(0);
  });

  it('guard rejects unrepresentable types and transforms', () => {
    const withDate = z.object({ at: z.union([z.string(), z.instanceof(Date)]) });
    const withPreprocess = z.object({ at: z.preprocess(v => v, z.string()) });

    expect(() => toAdapterJSONSchema(withDate, { io: 'input' })).toThrow(/cannot be represented/);
    expect(() => toAdapterJSONSchema(withPreprocess, { io: 'input' })).toThrow(/must not contain/);
  });

  describe.each(Object.entries(ADAPTER_CONVERSIONS))('%s conversion', (_adapter, params) => {
    it.each(toolCases)('$method ($contextName context)', ({ tool }) => {
      const jsonSchema = toAdapterJSONSchema(tool.parameters, params);
      expect(jsonSchema.type).toBe('object');
    });
  });
});
