import { Client } from '@hiero-ledger/sdk';
import type { Context } from './configuration';
import type { ToolType } from './tools';

export interface PreToolExecutionParams<TParams = any> {
  context: Context;
  rawParams: TParams;
  client: Client;
  /** The {@link ToolType} of the executing tool (`'query'` / `'transaction'` / `'other'`). */
  toolType: ToolType;
}

export interface PostParamsNormalizationParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  client: Client;
  /** The {@link ToolType} of the executing tool (`'query'` / `'transaction'` / `'other'`). */
  toolType: ToolType;
}

export interface PostCoreActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
  client: Client;
  /** The {@link ToolType} of the executing tool (`'query'` / `'transaction'` / `'other'`). */
  toolType: ToolType;
}

export interface PostSecondaryActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
  toolResult: any;
  client: Client;
  /** The {@link ToolType} of the executing tool (`'query'` / `'transaction'` / `'other'`). */
  toolType: ToolType;
}

/**
 * Abstract class for defining hooks that can be used to extend the functionality of the Hedera-Agent-Kit.
 * Hooks are executed in the order they are defined in the relevant tool's class.'
 */
export abstract class AbstractHook {
  public abstract name: string;
  public abstract description?: string;

  /**
   * The list of tool method names this hook applies to. The hook is a no-op for any tool not in
   * this list.
   *
   * Use the tool-name constants from `@hashgraph/hedera-agent-kit/plugins` rather than bare
   * strings to avoid typos — e.g.:
   *
   * ```ts
   * import { coreAccountPluginToolNames, coreTokenPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';
   *
   * relevantTools = [
   *   coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,          // 'transfer_hbar_tool'
   *   coreAccountPluginToolNames.TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
   *   coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL,
   * ];
   * ```
   *
   * Set `relevantTools = ['*']` to apply this hook to **every** tool regardless of method name.
   * This is useful for type-based hooks/policies that operate on `params.toolType` rather than
   * on a specific method name.
   *
   * Matching is **not** applied by the tool pipeline: `BaseTool` invokes every registered hook
   * and each handler decides for itself. Guard every override with
   * {@link appliesToMethod} so `relevantTools` (including `'*'`) is honoured:
   *
   * ```ts
   * override async preToolExecutionHook(params: PreToolExecutionParams, method: string) {
   *   if (!this.appliesToMethod(method)) return;
   *   // ...
   * }
   * ```
   *
   * {@link AbstractPolicy} already does this in all four handlers, so policies get `'*'`
   * support for free. See "Template for New Hook" in `docs/HOOKS_AND_POLICIES.md`.
   */
  public abstract relevantTools: string[];

  /**
   * Returns `true` when this hook should run for the given method.
   * The special sentinel `'*'` in {@link relevantTools} matches any method.
   *
   * Call this at the top of every handler you override. A handler that skips it runs for
   * every tool, ignoring `relevantTools` entirely.
   */
  protected appliesToMethod(method: string): boolean {
    return this.relevantTools.includes('*') || this.relevantTools.includes(method);
  }

  public async preToolExecutionHook(_params: PreToolExecutionParams, method: string): Promise<any> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postParamsNormalizationHook(
    _params: PostParamsNormalizationParams,
    method: string,
  ): Promise<any> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postCoreActionHook(_params: PostCoreActionParams, method: string): Promise<any> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postToolExecutionHook(
    _params: PostSecondaryActionParams,
    method: string,
  ): Promise<any> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
  }
}
