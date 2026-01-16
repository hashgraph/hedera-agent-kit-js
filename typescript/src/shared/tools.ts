import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';

import { enforcePolicies, ToolExecutionPoint } from './policy';

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
      await this.preToolExecutionHook(context, params);

      // 2. ParamsNormalization
      const normalisedParams = await this.normalizeParams(params, context, client);

      // 3. PostParamsNormalizationHook
      await this.postParamsNormalizationHook(context, params, normalisedParams);

      // 4. Core Action (Core Tool Logic)
      const coreActionResult = await this.coreAction(normalisedParams, context, client); // transactions will be created here

      // 5. PostCoreActionHook
      await this.postCoreActionHook(context, params, normalisedParams, coreActionResult);

      // 6. Secondary Action (Optional)
      let result = coreActionResult;
      if (await this.shouldSecondaryAction(coreActionResult, context)) {
        result = await this.secondaryAction(coreActionResult, client, context); // optional secondary action like tx signing, is not required for query tools and can be omitted
      }

      // 7. PostToolExecutionHook
      return await this.postToolExecutionHook(
        result,
        params,
        normalisedParams,
        coreActionResult,
        context,
      );
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  // Hooks
  async preToolExecutionHook(context: Context, params: TParams): Promise<void> {
    if (context.policies) {
      await enforcePolicies(
        context.policies,
        this.method,
        { rawParams: params },
        ToolExecutionPoint.PreToolExecution,
      );
    }
  }

  async postParamsNormalizationHook(
    context: Context,
    params: TParams,
    normalisedParams: TNormalisedParams,
  ): Promise<void> {
    if (context.policies) {
      await enforcePolicies(
        context.policies,
        this.method,
        { rawParams: params, normalisedParams },
        ToolExecutionPoint.PostParamsNormalization,
      );
    }
  }

  async postCoreActionHook(
    context: Context,
    params: TParams,
    normalisedParams: TNormalisedParams,
    coreActionResult: any,
  ): Promise<void> {
    if (context.policies) {
      await enforcePolicies(
        context.policies,
        this.method,
        { rawParams: params, normalisedParams, coreActionResult },
        ToolExecutionPoint.PostCoreAction,
      );
    }
  }

  /*
    Default implementation always returns true. Override in derived classes to implement custom logic.
   */
  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return true;
  }

  async postToolExecutionHook(
    toolResult: any,
    params: TParams,
    normalisedParams: TNormalisedParams,
    coreActionResult: any,
    context: Context,
  ): Promise<any> {
    if (context.policies) {
      await enforcePolicies(
        context.policies,
        this.method,
        {
          rawParams: params,
          normalisedParams,
          coreActionResult,
          toolResult,
        },
        ToolExecutionPoint.PostSecondaryAction,
      );
    }
    return toolResult;
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
