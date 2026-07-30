/**
 * Stage at which a policy blocked tool execution.
 *
 * Mirrors the four hook points in {@link AbstractPolicy}:
 * - `pre_tool_execution` — before params normalization; fired by `preToolExecutionHook`
 * - `post_params_normalization` — after params are resolved; fired by `postParamsNormalizationHook`
 * - `post_core_action` — after the core transaction is built; fired by `postCoreActionHook`
 * - `post_secondary_action` — after signing/execution; fired by `postToolExecutionHook`
 */
export const POLICY_BLOCK_STAGES = {
  PRE_TOOL_EXECUTION: 'pre_tool_execution',
  POST_PARAMS_NORMALIZATION: 'post_params_normalization',
  POST_CORE_ACTION: 'post_core_action',
  POST_SECONDARY_ACTION: 'post_secondary_action',
} as const;

export type PolicyBlockStage = (typeof POLICY_BLOCK_STAGES)[keyof typeof POLICY_BLOCK_STAGES];

/**
 * Thrown when a policy blocks tool execution at any hook stage.
 *
 * `AbstractPolicy` throws a base `PolicyBlockedError` automatically whenever a
 * `shouldBlock*` guard returns `true`. Custom policies that need to attach structured
 * `details` (e.g. `{ approvedUsd, capUsd }`) should throw a `PolicyBlockedError`
 * (or a typed subclass) directly from `shouldBlock*` instead of returning `true`.
 *
 * The `code` field (`'POLICY_BLOCKED'`) is stable and can be used to identify this
 * error class across module-boundary / bundling mismatches.  Prefer
 * {@link isPolicyBlockedError} over `instanceof` for that reason.
 *
 * @example
 * ```ts
 * // Custom policy with structured details
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
export class PolicyBlockedError extends Error {
  readonly code = 'POLICY_BLOCKED' as const;

  constructor(
    public readonly policyName: string,
    public readonly toolMethod: string,
    public readonly stage: PolicyBlockStage,
    public readonly description?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(
      `Action ${toolMethod} blocked by policy: ${policyName}${description ? ` (${description})` : ''}`,
    );
    this.name = 'PolicyBlockedError';
    // Ensure `instanceof` works correctly even when compiled to ES5 and when
    // a subclass calls super() — required for proper prototype chaining.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard for {@link PolicyBlockedError}.
 *
 * Uses both `instanceof` and a duck-typed `code` check so it survives scenarios where
 * multiple copies of `@hashgraph/hedera-agent-kit` are bundled (the error from one copy
 * will not be `instanceof` the class in another copy, but the `code` field is stable).
 */
export function isPolicyBlockedError(err: unknown): err is PolicyBlockedError {
  return (
    err instanceof PolicyBlockedError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as any).code === 'POLICY_BLOCKED' &&
      typeof (err as any).policyName === 'string')
  );
}

/**
 * Plain-JSON representation of a policy block, stored under `raw.policyBlock` in the
 * tool result envelope.
 *
 * This is the shape that **crosses the `JSON.stringify` boundary** in
 * `HederaAgentAPI.run()`. The `PolicyBlockedError` instance itself does not survive
 * serialization; this plain object does.
 *
 * Use {@link isPolicyBlockedToolResult} to check whether a `{ raw, humanMessage }`
 * envelope contains a policy block, or pass the envelope to {@link classifyToolResult}
 * to get a typed `ToolResultStatus` with `kind: 'policy_block'`.
 */
export interface PolicyBlockInfo {
  /** Stable discriminant. Always `'POLICY_BLOCKED'`. */
  code: 'POLICY_BLOCKED';
  /** Display name of the policy that fired (matches `AbstractPolicy.name`). */
  policyName: string;
  /** The tool method that was blocked (e.g. `'transfer_hbar'`). */
  toolMethod: string;
  /** Hook stage at which the block occurred. */
  stage: PolicyBlockStage;
  /** Optional human-readable description from the policy. */
  description?: string;
  /** Optional structured details provided by the policy (e.g. `{ recipientCount, maxRecipients }`). */
  details?: Record<string, unknown>;
}
