import { Context } from './configuration';
import {
  AbstractHook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
} from './abstract-hook';

/**
 * Policy extends Hook and throws errors when validation fails.
 */
export abstract class Policy extends AbstractHook {
  public abstract name: string;
  public abstract description?: string;
  public abstract relevantTools: string[];

  /**
   * Default implementation - no validation at PreToolExecution.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPreToolExecution(
    _context: Context,
    _params: PreToolExecutionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostParamsNormalization.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostParamsNormalization(
    _context: Context,
    _params: PostParamsNormalizationParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostCoreAction.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostCoreAction(
    _context: Context,
    _params: PostCoreActionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostSecondaryAction.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostSecondaryAction(
    _context: Context,
    _params: PostSecondaryActionParams,
  ): boolean | Promise<boolean> {
    return false;
  }

  // Hook implementations that throw when validation fails
  /** @internal */
  public async preToolExecutionHook(
    context: Context,
    params: PreToolExecutionParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPreToolExecution(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postParamsNormalizationHook(
    context: Context,
    params: PostParamsNormalizationParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostParamsNormalization(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postCoreActionHook(
    context: Context,
    params: PostCoreActionParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostCoreAction(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postSecondaryActionHook(
    context: Context,
    params: PostSecondaryActionParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostSecondaryAction(context, params);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }
}
