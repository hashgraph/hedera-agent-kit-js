import { BaseTool, TOOL_TYPE, ToolType } from './tools';

/**
 * Abstract base class for all Hedera read-only (query) tools.
 *
 * Extends {@link BaseTool} and sets `toolType` to `'query'` so consumers can
 * declaratively distinguish read-only tools from state-mutating ones without
 * relying on name-prefix heuristics:
 *
 * ```ts
 * // LangChain / ADK / ElizaOS — getTools() returns an array:
 * toolkit.getTools().filter(t => t.toolType === TOOL_TYPE.QUERY)
 *
 * // AI SDK — getTools() returns a keyed record, use Object.entries:
 * Object.fromEntries(
 *   Object.entries(toolkit.getTools()).filter(([, t]) => t.toolType === TOOL_TYPE.QUERY)
 * )
 *
 * // Core API (adapter-agnostic, via HederaAgentAPI.listTools()):
 * api.listTools().filter(s => s.toolType === TOOL_TYPE.QUERY).map(s => s.method)
 * ```
 *
 * Query tools fetch data from the Hedera mirror node or network and never
 * submit a transaction. They therefore do not need the Hedera-specific error
 * handling that {@link BaseTransactionTool} adds for receipt/precheck failures.
 */
export abstract class BaseQueryTool extends BaseTool {
  toolType: ToolType = TOOL_TYPE.QUERY;
}
