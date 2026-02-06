import { Context } from './configuration';

export enum ToolExecutionStep {
  PreToolExecution = 'PreToolExecution',
  PostParamsNormalization = 'PostParamsNormalization',
  PostCoreAction = 'PostCoreAction',
  PostSecondaryAction = 'PostSecondaryAction',
}

export interface PreToolExecutionParams<TParams = any> {
  context: Context;
  rawParams: TParams;
}

export interface PostParamsNormalizationParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
}

export interface PostCoreActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
}

export interface PostSecondaryActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
  toolResult: any;
}

export type AnyHookParams =
  | PreToolExecutionParams
  | PostParamsNormalizationParams
  | PostCoreActionParams
  | PostSecondaryActionParams;

export interface Policy {
  /**
   * The name of the policy.
   */
  name: string;

  /**
   * Optional explanation of the policy for logging/debugging.
   */
  description?: string;

  /**
   * List of tool names this policy applies to.
   */
  relevantTools: string[];

  /**
   * Validate at PreToolExecution point.
   * @param context - The execution context.
   * @param params - The validation parameters.
   * @returns true if policy blocks the action, false otherwise.
   */
  validatePreToolExecution(
    context: Context,
    params: PreToolExecutionParams,
  ): boolean | Promise<boolean>;

  /**
   * Validate at PostParamsNormalization point.
   * @param context - The execution context.
   * @param params - The validation parameters.
   * @returns true if policy blocks the action, false otherwise.
   */
  validatePostParamsNormalization(
    context: Context,
    params: PostParamsNormalizationParams,
  ): boolean | Promise<boolean>;

  /**
   * Validate at PostCoreAction point.
   * @param context - The execution context.
   * @param params - The validation parameters.
   * @returns true if policy blocks the action, false otherwise.
   */
  validatePostCoreAction(
    context: Context,
    params: PostCoreActionParams,
  ): boolean | Promise<boolean>;

  /**
   * Validate at PostSecondaryAction point.
   * @param context - The execution context.
   * @param params - The validation parameters.
   * @returns true if policy blocks the action, false otherwise.
   */
  validatePostSecondaryAction(
    context: Context,
    params: PostSecondaryActionParams,
  ): boolean | Promise<boolean>;

  /**
   * Enforce the policy at a specific execution point.
   * Checks if the policy applies to the given tool and hook point, then validates.
   * @param context - The execution context.
   * @param toolName - The name of the tool being executed.
   * @param hookPoint - The execution point where the policy is being enforced.
   * @param params - The validation parameters object to check.
   * @returns true if policy blocks the action, false otherwise.
   */
  enforce(
    context: Context,
    toolName: string,
    hookPoint: ToolExecutionStep,
    params: AnyHookParams,
  ): Promise<boolean>;
}

/**
 * Base implementation of Policy interface.
 */
export abstract class BasePolicy implements Policy {
  abstract name: string;
  abstract description?: string;
  abstract relevantTools: string[];

  /**
   * Default implementation - no validation at PreToolExecution.
   * Override in derived classes to implement custom logic.
   */
  validatePreToolExecution(
    _context: Context,
    _params: PreToolExecutionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostParamsNormalization.
   * Override in derived classes to implement custom logic.
   */
  validatePostParamsNormalization(
    _context: Context,
    _params: PostParamsNormalizationParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostCoreAction.
   * Override in derived classes to implement custom logic.
   */
  validatePostCoreAction(
    _context: Context,
    _params: PostCoreActionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostSecondaryAction.
   * Override in derived classes to implement custom logic.
   */
  validatePostSecondaryAction(
    _context: Context,
    _params: PostSecondaryActionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  async enforce(
    context: Context,
    toolName: string,
    hookPoint: ToolExecutionStep,
    params: AnyHookParams,
  ): Promise<boolean> {
    // Check if the policy applies to this tool
    if (!this.relevantTools.includes(toolName)) {
      return false;
    }

    // Map hook point to validation method
    switch (hookPoint) {
      case ToolExecutionStep.PreToolExecution:
        return await this.validatePreToolExecution(context, params as PreToolExecutionParams);
      case ToolExecutionStep.PostParamsNormalization:
        return await this.validatePostParamsNormalization(
          context,
          params as PostParamsNormalizationParams,
        );
      case ToolExecutionStep.PostCoreAction:
        return await this.validatePostCoreAction(context, params as PostCoreActionParams);
      case ToolExecutionStep.PostSecondaryAction:
        return await this.validatePostSecondaryAction(context, params as PostSecondaryActionParams);
      default:
        return false;
    }
  }
}
