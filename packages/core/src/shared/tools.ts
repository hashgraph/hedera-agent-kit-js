import { z } from 'zod';
import { Client } from '@hiero-ledger/sdk';
import { Context } from './configuration';
import { TOOL_STATUS } from '@/shared/utils';

import {
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
  AbstractHook,
} from './hook';

export interface Tool {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
  // transactionToolOutputParser and untypedQueryOutputParser can be used. If required, define a custom parser
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string };
}

/**
 * Base class for all Hedera Agent Kit tools. Subclasses implement the
 * `coreAction` / `secondaryAction` pipeline and inherit a standard
 * `{ raw, humanMessage }` output envelope.
 *
 * ## `raw.status` contract
 *
 * Every tool returns a `raw` object whose `status` field signals outcome:
 *
 * | `raw.status`    | Source                                          | Meaning                                                                 |
 * |-----------------|-------------------------------------------------|-------------------------------------------------------------------------|
 * | `'SUCCESS'`     | `BaseTool.execute()` (defaulted via `??=`), `ReturnBytesStrategy`, or `ExecuteStrategy` | Operation completed successfully. Any tool that reaches the end of `execute()` without an explicit `raw.status` is automatically assigned `'SUCCESS'`. |
 * | `'ERROR'`       | `BaseTool.handleError()` / `BaseTransactionTool.handleError()` | Caught exception. Transaction tools extend `BaseTransactionTool`, which additionally sets `raw.errorCode` (specific SDK status name, e.g. `'INSUFFICIENT_PAYER_BALANCE'`) and `raw.transactionId` for Hedera receipt/precheck failures. |
 * | `'PARSE_ERROR'` | `transactionToolOutputParser` / `untypedQueryOutputParser` | Output is not valid JSON or has an unexpected shape.                     |
 *
 * Use {@link classifyToolResult} to map these into the stable
 * `ToolResultStatus` discriminated union (`success | failure | parse_error | unknown`).
 */
export abstract class BaseTool<TParams = any, TNormalisedParams = any> implements Tool {
  abstract method: string;
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodObject<any, any>;
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string };

  async execute(client: Client, context: Context, params: TParams): Promise<any> {
    try {
      // 1. PreToolExecutionHook
      await this.preToolExecutionHook({ context, rawParams: params, client });

      // 2. ParamsNormalization
      const normalisedParams = await this.normalizeParams(params, context, client);

      // 3. PostParamsNormalizationHook
      await this.postParamsNormalizationHook({
        context,
        rawParams: params,
        normalisedParams,
        client,
      });

      // 4. Core Action (Core Tool Logic)
      const coreActionResult = await this.coreAction(normalisedParams, context, client); // transactions will be created here

      // 5. PostCoreActionHook
      await this.postCoreActionHook({
        context,
        rawParams: params,
        normalisedParams,
        coreActionResult,
        client,
      });

      // 6. Secondary Action (Optional)
      let result = coreActionResult;
      if (await this.shouldSecondaryAction(coreActionResult, context)) {
        result = await this.secondaryAction(coreActionResult, client, context); // optional secondary action like tx signing, is not required for query tools and can be omitted
      }

      // Default raw.status to SUCCESS for any tool that did not set it explicitly.
      // ExecuteStrategy and ReturnBytesStrategy already set it; this covers query
      // tools and third-party tools that return a raw envelope without a status.
      if (result && typeof result.raw === 'object' && result.raw !== null) {
        result.raw.status ??= TOOL_STATUS.SUCCESS;
      }

      // 7. PostToolExecutionHook
      return await this.postToolExecutionHook({
        context,
        rawParams: params,
        normalisedParams,
        coreActionResult,
        toolResult: result,
        client,
      });
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  // Hooks
  async preToolExecutionHook(params: PreToolExecutionParams<TParams>): Promise<void> {
    await this.executeHooks(params.context, async (h, method) =>
      h.preToolExecutionHook(params, method),
    );
  }

  async postParamsNormalizationHook(
    params: PostParamsNormalizationParams<TParams, TNormalisedParams>,
  ): Promise<void> {
    await this.executeHooks(params.context, async (h, method) =>
      h.postParamsNormalizationHook(params, method),
    );
  }

  async postCoreActionHook(
    params: PostCoreActionParams<TParams, TNormalisedParams>,
  ): Promise<void> {
    await this.executeHooks(params.context, async (h, method) =>
      h.postCoreActionHook(params, method),
    );
  }

  /*
    Default implementation always returns true. Override in derived classes to implement custom logic.
  */
  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return true;
  }

  async postToolExecutionHook(
    params: PostSecondaryActionParams<TParams, TNormalisedParams>,
  ): Promise<any> {
    await this.executeHooks(params.context, async (h, method) =>
      h.postToolExecutionHook(params, method),
    );
    return params.toolResult;
  }

  /**
   * Generic hook execution method that executes hooks on all registered hooks.
   * Hook-agnostic: just awaits the hook executor without caring about the result.
   * @param context - The execution context.
   * @param hookExecutor - The hook function to execute on each hook.
   */
  protected async executeHooks(
    context: Context,
    hookExecutor: (hook: AbstractHook, method: string) => Promise<any>,
  ): Promise<void> {
    if (!context.hooks) {
      return;
    }

    for (const hook of context.hooks) {
      await hookExecutor(hook, this.method);
    }
  }

  /**
   * Default error handler called when any step of `execute()` throws.
   * Returns `{ raw: { status: 'ERROR', error: string }, humanMessage: string }`.
   * Transaction tools extend `BaseTransactionTool` which overrides this to
   * additionally extract structured fields from `ReceiptStatusError` and
   * `PrecheckStatusError`.
   */
  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = `Failed to execute ${this.name}`;
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error(`[${this.method}]`, message);
    return { raw: { status: TOOL_STATUS.ERROR, error: message }, humanMessage: message };
  }

  // Abstract steps
  abstract normalizeParams(
    params: TParams,
    context: Context,
    client: Client,
  ): Promise<TNormalisedParams>;
  abstract coreAction(
    normalisedParams: TNormalisedParams,
    context: Context,
    client: Client,
  ): Promise<any>;
  // Override in subclasses that require a secondary action (e.g. transaction signing).
  // Throws by default so a misconfigured shouldSecondaryAction=true fails loudly rather than silently.
  async secondaryAction(_request: any, _client: Client, _context: Context): Promise<any> {
    throw new Error(
      `${this.name}: secondaryAction called but not implemented. Override it or ensure shouldSecondaryAction returns false.`,
    );
  }
}

export default Tool;
