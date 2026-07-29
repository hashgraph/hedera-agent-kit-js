import { BaseTool, TOOL_TYPE, ToolType } from './tools';

/**
 * Abstract base class for all Hedera read-only (query) tools.
 *
 * Extends {@link BaseTool} and sets `toolType` to `'query'` so consumers can
 * declaratively distinguish read-only tools from state-mutating ones without
 * relying on name-prefix heuristics:
 *
 * ```ts
 * toolkit.getTools().filter(t => t.toolType === TOOL_TYPE.QUERY)
 * ```
 *
 * Query tools fetch data from the Hedera mirror node or network and never
 * submit a transaction. They therefore do not need the Hedera-specific error
 * handling that {@link BaseTransactionTool} adds for receipt/precheck failures.
 */
export abstract class BaseQueryTool extends BaseTool {
  toolType: ToolType = TOOL_TYPE.QUERY;
}
