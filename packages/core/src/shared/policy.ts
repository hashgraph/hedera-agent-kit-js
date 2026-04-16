import {
  AbstractHook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
} from './hook';

/**
 * AbstractPolicy extends AbstractHook and throws errors when validation fails.
 */
export abstract class AbstractPolicy extends AbstractHook {
  public abstract name: string;
  public abstract description?: string;
  public abstract relevantTools: string[];

  /**
   * Default implementation - no validation at PreToolExecution.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPreToolExecution(
    _params: PreToolExecutionParams,
    _method: string,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostParamsNormalization.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostParamsNormalization(
    _params: PostParamsNormalizationParams,
    _method: string,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostCoreAction.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostCoreAction(
    _params: PostCoreActionParams,
    _method: string,
  ): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Default implementation - no validation at PostSecondaryAction.
   * Override in derived classes to implement custom logic.
   */
  protected shouldBlockPostSecondaryAction(
    _params: PostSecondaryActionParams,
    _method: string,
  ): boolean | Promise<boolean> {
    return false;
  }

  // Hook implementations that throw when validation fails
  /** @internal */
  public async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPreToolExecution(params, method);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postParamsNormalizationHook(
    params: PostParamsNormalizationParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostParamsNormalization(params, method);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postCoreActionHook(params: PostCoreActionParams, method: string): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostCoreAction(params, method);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postToolExecutionHook(
    params: PostSecondaryActionParams,
    method: string,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostSecondaryAction(params, method);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }
}
