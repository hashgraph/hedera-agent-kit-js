import { z } from 'zod';
import { Client } from '@hiero-ledger/sdk';
import { Context } from './configuration';

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

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = `Failed to execute ${this.name}`;
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error(`[${this.method}]`, message);
    return { raw: { error: message }, humanMessage: message };
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
  abstract secondaryAction(request: any, client: Client, context: Context): Promise<any>;
}

export default Tool;
