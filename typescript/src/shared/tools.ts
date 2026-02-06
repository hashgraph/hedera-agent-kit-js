import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';

import {
  ToolExecutionStep,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
  AnyHookParams,
} from './policy';

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
      await this.preToolExecutionHook({ context, rawParams: params });

      // 2. ParamsNormalization
      const normalisedParams = await this.normalizeParams(params, context, client);

      // 3. PostParamsNormalizationHook
      await this.postParamsNormalizationHook({ context, rawParams: params, normalisedParams });

      // 4. Core Action (Core Tool Logic)
      const coreActionResult = await this.coreAction(normalisedParams, context, client); // transactions will be created here

      // 5. PostCoreActionHook
      await this.postCoreActionHook({
        context,
        rawParams: params,
        normalisedParams,
        coreActionResult,
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
      });
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  // Hooks
  async preToolExecutionHook(params: PreToolExecutionParams<TParams>): Promise<void> {
    await this.executeHook(params.context, ToolExecutionStep.PreToolExecution, params);
  }

  async postParamsNormalizationHook(
    params: PostParamsNormalizationParams<TParams, TNormalisedParams>,
  ): Promise<void> {
    await this.executeHook(params.context, ToolExecutionStep.PostParamsNormalization, params);
  }

  async postCoreActionHook(
    params: PostCoreActionParams<TParams, TNormalisedParams>,
  ): Promise<void> {
    await this.executeHook(params.context, ToolExecutionStep.PostCoreAction, params);
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
    await this.executeHook(params.context, ToolExecutionStep.PostSecondaryAction, params);
    return params.toolResult;
  }

  /**
   * Generic hook execution method that enforces policies.
   * @param context - The execution context.
   * @param hookPoint - The execution point.
   * @param params - The validation parameters.
   */
  private async executeHook(
    context: Context,
    hookPoint: ToolExecutionStep,
    params: AnyHookParams,
  ): Promise<void> {
    if (!context.policies) {
      return;
    }

    for (const policy of context.policies) {
      const shouldBlock = await policy.enforce(context, this.method, hookPoint, params);
      if (shouldBlock) {
        const reason = policy.description ? ` (${policy.description})` : '';
        throw new Error(`Action blocked by policy: ${policy.name}${reason}`);
      }
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
