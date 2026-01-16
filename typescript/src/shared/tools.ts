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

export abstract class BaseTool<TParams = any, TNormalisedParams = any, TResult = any> implements Tool {
  abstract method: string;
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodObject<any, any>;
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string };

  async execute(client: Client, context: Context, params: TParams): Promise<any> {
    try {
      // 1. PreToolExcutionHook
      await this.preToolExecutionHook(context, params);

      // 2. ParamsNormalization
      const normalisedParams = await this.normalizeParams(params, context, client);

      // 3. PostParamsNormalizationHook
      await this.postParamsNormalizationHook(context, normalisedParams);

      // 4. Action (Core Tool Logic)
      const request = await this.action(normalisedParams, context, client);

      // 5. PostActionHook
      await this.postActionHook(context, request);

      // 6. Submit (Optional)
      let result = request;
      if (await this.shouldSubmit(request, context)) {
        result = await this.submit(request, client, context);
      }

      // 7. PostSubmitHook
      return await this.postSubmitHook(result, context);
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  // Hooks
  async preToolExecutionHook(context: Context, params: TParams): Promise<void> {
    if (context.policies) {
      await enforcePolicies(context.policies, this.method, params, ToolExecutionPoint.PreToolExecution);
    }
  }

  async postParamsNormalizationHook(context: Context, normalisedParams: TNormalisedParams): Promise<void> {
    if (context.policies) {
      await enforcePolicies(
        context.policies,
        this.method,
        normalisedParams,
        ToolExecutionPoint.PostParamsNormalization
      );
    }
  }

  async postActionHook(context: Context, request: any): Promise<void> {
    if (context.policies) {
      await enforcePolicies(context.policies, this.method, request, ToolExecutionPoint.PostAction);
    }
  }

  async shouldSubmit(request: any, context: Context): Promise<boolean> {
    return true;
  }

  async postSubmitHook(result: any, context: Context): Promise<any> {
    if (context.policies) {
      await enforcePolicies(context.policies, this.method, result, ToolExecutionPoint.PostSubmit);
    }
    return result;
  }

  async handleError(error: unknown, context: Context): Promise<any> {
    const desc = `Failed to execute ${this.name}`;
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error(`[${this.method}]`, message);
    return { raw: { error: message }, humanMessage: message };
  }

  // Abstract steps
  abstract normalizeParams(params: TParams, context: Context, client: Client): Promise<TNormalisedParams>;
  abstract action(normalisedParams: TNormalisedParams, context: Context, client: Client): Promise<any>;
  abstract submit(request: any, client: Client, context: Context): Promise<any>;
}

export default Tool;
