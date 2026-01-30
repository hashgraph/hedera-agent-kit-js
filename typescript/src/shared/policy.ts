export enum ToolExecutionPoint {
  PreToolExecution = 'PreToolExecution',
  PostParamsNormalization = 'PostParamsNormalization',
  PostCoreAction = 'PostCoreAction',
  PostSecondaryAction = 'PostSecondaryAction',
}

export interface PolicyValidationParams<TParams = any, TNormalisedParams = any> {
  /**
   * The raw parameters passed to the tool.
   */
  rawParams: TParams;

  /**
   * The normalised parameters after validation (available in PostParamsNormalization and later).
   */
  normalisedParams?: TNormalisedParams;

  /**
   * The result of the action/transaction creation (available in PostCoreAction and later).
   */
  coreActionResult?: any;

  /**
   * The result of the core action or secondary action if that was called (available in PostSecondaryAction).
   */
  toolResult?: any;
}

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
   * List of execution points this policy applies to.
   * If not provided, it defaults to PostParamsNormalization for backward compatibility.
   */
  affectedPoints?: ToolExecutionPoint[];

  /**
   * Returns true if the action should be blocked.
   * @param validationParams - The validation parameters object containing context-specific data.
   * @returns boolean or Promise<boolean> indicating if the action should be blocked.
   */
  shouldBlock: (validationParams: PolicyValidationParams) => boolean | Promise<boolean>;
}

/**
 * Helper function to enforce policies.
 * Throws an error if any policy blocks the action.
 *
 * @param policies - The list of policies to enforce.
 * @param toolName - The name of the tool being executed.
 * @param validationParams - The validation parameters object to check.
 * @param point - The current execution point.
 */
export async function enforcePolicies(
  policies: Policy[],
  toolName: string,
  validationParams: PolicyValidationParams,
  point: ToolExecutionPoint,
): Promise<void> {
  for (const policy of policies) {
    if (policy.relevantTools.includes(toolName)) {
      // Default to PostParamsNormalization if not specified
      const affectedPoints = policy.affectedPoints || [ToolExecutionPoint.PostParamsNormalization];

      if (affectedPoints.includes(point)) {
        const shouldBlock = await policy.shouldBlock(validationParams);
        if (shouldBlock) {
          const reason = policy.description ? ` (${policy.description})` : '';
          throw new Error(`Action blocked by policy: ${policy.name}${reason}`);
        }
      }
    }
  }
}
