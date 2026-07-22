import { Client } from '@hiero-ledger/sdk';

import type { Context } from './configuration';
import type { Tool } from './tools';

/** Lightweight projection of a {@link Tool} for safe introspection — omits the Zod schema and execute handler. */
export type ToolSummary = Pick<Tool, 'method' | 'name' | 'description'>;

/**
 * Runtime API wrapper around a Hedera/Hiero {@link Client} and a registry of {@link Tool} instances.
 *
 * Consumers use this class to discover available tools via {@link listTools} and execute them by
 * method name via {@link run}.
 *
 * @remarks
 * In most cases you will not instantiate this class directly. The official adapter packages each
 * wrap `HederaAgentAPI` internally and expose a framework-specific toolkit:
 *
 * - `@hashgraph/hedera-agent-kit-langchain` — `HederaLangchainToolkit`
 * - `@hashgraph/hedera-agent-kit-ai-sdk`    — `HederaAIToolkit`
 * - `@hashgraph/hedera-agent-kit-mcp`       — `HederaMCPToolkit`
 * - `@hashgraph/hedera-agent-kit-adk`       — `HederaADKToolkit`
 *
 * All adapters follow the same delegation pattern: they construct `HederaAgentAPI` with
 * `(client, configuration.context, allTools)` and forward tool calls to {@link run}.
 * Reach for this class directly only when building a custom integration that none of the
 * above adapters cover.
 *
 * @example
 * ```ts
 * // Custom adapter — wraps HederaAgentAPI for a hypothetical agent framework
 * import HederaAgentAPI, {
 *   ToolDiscovery,
 *   type Configuration,
 * } from '@hashgraph/hedera-agent-kit';
 * import { Client } from '@hiero-ledger/sdk';
 *
 * class MyFrameworkToolkit {
 *   private api: HederaAgentAPI;
 *   readonly tools: Record<string, { description: string; execute: (args: unknown) => Promise<string> }>;
 *
 *   constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
 *     const discovery = ToolDiscovery.createFromConfiguration(configuration);
 *     const allTools  = discovery.getAllTools(configuration.context ?? {}, configuration);
 *
 *     this.api   = new HederaAgentAPI(client, configuration.context, allTools);
 *     this.tools = Object.fromEntries(
 *       allTools.map(tool => [
 *         tool.method,
 *         {
 *           description: tool.description,
 *           execute: (args: unknown) => this.api.run(tool.method, args),
 *         },
 *       ]),
 *     );
 *   }
 * }
 * ```
 *
 * @see {@link Tool}
 * @see {@link Context}
 * @see {@link ToolSummary}
 */
class HederaAgentAPI {
  /** Hiero SDK `Client` connected to a Hedera network. */
  client: Client;

  /** Execution context applied to every tool call — account, mode, mirrornode config, and hooks. See {@link Context}. */
  context: Context;

  /** Registered {@link Tool} instances available for dispatch via {@link run}. */
  tools: Tool[];

  /**
   * @param client - Connected Hiero SDK `Client`; must have `ledgerId` set.
   * @param context - Optional execution context; defaults to `{}`.
   * @param tools - Optional tool registry; defaults to `[]`.
   * @throws {Error} When `client` is falsy ("HederaAgentAPI requires a connected Client").
   * @throws {Error} When `client.ledgerId` is falsy ("Client must be connected to a network").
   */
  constructor(client: Client, context?: Context, tools?: Tool[]) {
    if (!client) throw new Error('HederaAgentAPI requires a connected Client');
    this.client = client;
    if (!this.client.ledgerId) {
      throw new Error('Client must be connected to a network');
    }
    this.context = context || {};
    this.tools = tools || [];
  }

  /**
   * Returns a summary of all registered tools without exposing executable handlers or parameter schemas.
   * @returns Array of {@link ToolSummary} objects, each containing `method`, `name`, and `description`.
   */
  listTools(): ToolSummary[] {
    return this.tools.map(({ method, name, description }) => ({ method, name, description }));
  }

  /**
   * Dispatches to the matching {@link Tool} by `method` name, executes it with the provided
   * arguments, and returns the JSON-stringified output.
   *
   * @param method - The `Tool.method` identifier to look up.
   * @param arg - Arguments forwarded to `tool.execute()`.
   * @returns JSON-stringified result from the tool.
   * @throws {Error} When no registered tool matches the given `method` ("Invalid method <method>").
   */
  async run(method: string, arg: unknown): Promise<string> {
    const tool = this.tools.find(t => t.method === method);
    if (tool) {
      const output = JSON.stringify(await tool.execute(this.client, this.context, arg));
      return output;
    } else {
      throw new Error('Invalid method ' + method);
    }
  }
}

export default HederaAgentAPI;
