import {
  AbstractHook,
  PreToolExecutionParams,
  PostParamsNormalizationParams,
  PostCoreActionParams,
  PostSecondaryActionParams,
} from './hook';
import { PolicyBlockedError, POLICY_BLOCK_STAGES } from './policy-blocked-error';

/**
 * AbstractPolicy extends AbstractHook and throws {@link PolicyBlockedError} when
 * validation fails.
 *
 * ## Blocking execution
 *
 * The simplest way to block is to return `true` from a `shouldBlock*` guard.
 * `AbstractPolicy` will automatically throw a base `PolicyBlockedError` with the policy
 * `name`, `description`, the blocked `toolMethod`, and the hook `stage`.
 *
 * If you need to attach **structured details** (e.g. `{ approvedUsd, capUsd }`) to the
 * block, throw a `PolicyBlockedError` (or a typed subclass) directly from `shouldBlock*`
 * instead of returning `true`. The error propagates through `BaseTool.execute()`'s
 * try/catch and is handled by `BaseTool.handleError`, which lifts `policyBlock` info
 * onto `raw.policyBlock` so it survives JSON serialization.
 *
 * @example Returning `true` (simple block, no extra details)
 * ```ts
 * protected shouldBlockPreToolExecution(_params, _method) {
 *   return this.isBlocked;
 * }
 * ```
 *
 * @example Throwing with structured details
 * ```ts
 * protected shouldBlockPostParamsNormalization(params, method) {
 *   if (params.normalisedParams.amount > this.cap) {
 *     throw new PolicyBlockedError(
 *       this.name, method, POLICY_BLOCK_STAGES.POST_PARAMS_NORMALIZATION,
 *       this.description,
 *       { approved: params.normalisedParams.amount, cap: this.cap },
 *     );
 *   }
 *   return false;
 * }
 * ```
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
   * Override to implement validation after parameters have been normalised but before the
   * transaction is built. Return `true` to block execution.
   *
   * **`hbarTransfers[].amount` is not always a plain number.**
   * After normalisation it can be `Hbar | Long | number | string` depending on what the caller
   * supplied. Do not compare it with `>` directly — it will silently return `false` for `Hbar`
   * and `Long` objects. Use duck-typing to handle all variants:
   *
   * ```ts
   * function isPositive(amt: unknown): boolean {
   *   if (amt == null) return false;
   *   if (typeof amt === 'object') {
   *     // Hbar → .toBigNumber(); Long → already BigNumber-compatible via .toNumber()
   *     const bn = typeof (amt as any).toBigNumber === 'function'
   *       ? (amt as any).toBigNumber()
   *       : amt;
   *     return typeof (bn as any).isGreaterThan === 'function'
   *       ? (bn as any).isGreaterThan(0)
   *       : Number(amt) > 0;
   *   }
   *   return Number(amt) > 0;
   * }
   * ```
   *
   * See `MaxRecipientsPolicy` for a complete reference implementation.
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
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPreToolExecution(params, method);
    if (shouldBlock) {
      throw new PolicyBlockedError(
        this.name,
        method,
        POLICY_BLOCK_STAGES.PRE_TOOL_EXECUTION,
        this.description,
      );
    }
  }

  /** @internal */
  public async postParamsNormalizationHook(
    params: PostParamsNormalizationParams,
    method: string,
  ): Promise<void> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostParamsNormalization(params, method);
    if (shouldBlock) {
      throw new PolicyBlockedError(
        this.name,
        method,
        POLICY_BLOCK_STAGES.POST_PARAMS_NORMALIZATION,
        this.description,
      );
    }
  }

  /** @internal */
  public async postCoreActionHook(params: PostCoreActionParams, method: string): Promise<void> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostCoreAction(params, method);
    if (shouldBlock) {
      throw new PolicyBlockedError(
        this.name,
        method,
        POLICY_BLOCK_STAGES.POST_CORE_ACTION,
        this.description,
      );
    }
  }

  /** @internal */
  public async postToolExecutionHook(
    params: PostSecondaryActionParams,
    method: string,
  ): Promise<void> {
    if (!this.appliesToMethod(method)) return; // break execution if this hook does not apply to the current tool
    const shouldBlock = await this.shouldBlockPostSecondaryAction(params, method);
    if (shouldBlock) {
      throw new PolicyBlockedError(
        this.name,
        method,
        POLICY_BLOCK_STAGES.POST_SECONDARY_ACTION,
        this.description,
      );
    }
  }
}
