export enum ToolExecutionPoint {
    PreToolExecution = 'PreToolExecution',
    PostParamsNormalization = 'PostParamsNormalization',
    PostAction = 'PostAction',
    PostSubmit = 'PostSubmit',
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
     * @param params - The normalised parameters (or raw params/request depending on hook) for the tool.
     * @returns boolean or Promise<boolean> indicating if the action should be blocked.
     */
    shouldBlock: (params: any) => boolean | Promise<boolean>;
}

/**
 * Helper function to enforce policies.
 * Throws an error if any policy blocks the action.
 *
 * @param policies - The list of policies to enforce.
 * @param toolName - The name of the tool being executed.
 * @param params - The parameters/request object to check.
 * @param point - The current execution point.
 */
export async function enforcePolicies(
    policies: Policy[],
    toolName: string,
    params: any,
    point: ToolExecutionPoint
): Promise<void> {
    for (const policy of policies) {
        if (policy.relevantTools.includes(toolName)) {
            // Default to PostParamsNormalization if not specified
            const affectedPoints = policy.affectedPoints || [ToolExecutionPoint.PostParamsNormalization];

            if (affectedPoints.includes(point)) {
                const shouldBlock = await policy.shouldBlock(params);
                if (shouldBlock) {
                    const reason = policy.description ? ` (${policy.description})` : '';
                    throw new Error(`Action blocked by policy: ${policy.name}${reason}`);
                }
            }
        }
    }
}
