import { Context } from './configuration';
import {
  Hook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
} from './hook';

/**
 * Policy extends Hook and throws errors when validation fails.
 */
export abstract class Policy extends Hook {
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

  // Hook implementations that throw when validation fails
  async preToolExecutionHook(context: Context, params: PreToolExecutionParams): Promise<void> {
    const shouldBlock = await this.validatePreToolExecution(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  async postParamsNormalizationHook(
    context: Context,
    params: PostParamsNormalizationParams,
  ): Promise<void> {
    const shouldBlock = await this.validatePostParamsNormalization(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  async postCoreActionHook(context: Context, params: PostCoreActionParams): Promise<void> {
    const shouldBlock = await this.validatePostCoreAction(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  async postSecondaryActionHook(
    context: Context,
    params: PostSecondaryActionParams,
  ): Promise<void> {
    const shouldBlock = await this.validatePostSecondaryAction(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }
}

// Re-export hook types for convenience
export {
  Hook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
  AnyHookParams,
} from './hook';
