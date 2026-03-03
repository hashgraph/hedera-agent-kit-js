import { Context } from './configuration';
import {
  AbstractHook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
} from './abstract-hook';
import { Client } from '@hashgraph/sdk';

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
    _client: Client,
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
    _client: Client,
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
    _client: Client,
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
    _client: Client,
  ): boolean | Promise<boolean> {
    return false;
  }

  // Hook implementations that throw when validation fails
  /** @internal */
  public async preToolExecutionHook(
    context: Context,
    params: PreToolExecutionParams,
    method: string,
    client: Client,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPreToolExecution(context, params, client);
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
    client: Client,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostParamsNormalization(context, params, client);
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
    client: Client,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostCoreAction(context, params, client);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }

  /** @internal */
  public async postToolExecutionHook(
    context: Context,
    params: PostSecondaryActionParams,
    method: string,
    client: Client,
  ): Promise<void> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostSecondaryAction(context, params, client);
    if (shouldBlock) {
      throw new Error(
        `Action ${method} blocked by policy: ${this.name}${this.description ? ` (${this.description})` : ''}`,
      );
    }
  }
}
