# Policies in Hedera Agent Kit

Policies are a powerful mechanism in the Hedera Agent Kit that allow you to enforce rules, validate actions, and control the execution flow of tools. They are built upon a flexible hook system, enabling you to intercept and inspect tool execution at various stages.

## Overview

A **Policy** is essentially a specialized **Hook** that can block the execution of a tool if certain conditions are not met. All policies extend the `AbstractHook` class (and specifically the `Policy` abstract class) and are registered in the agent's configuration.

### How Policies Work

When a tool is executed, it goes through several lifecycle stages:
1.  **Pre-Tool Execution**: Before any logic runs.
2.  **Post-Params Normalization**: After input parameters have been validated and normalized.
3.  **Post-Core Action**: After the main action (e.g., transaction creation) has occurred.
4.  **Post-Secondary Action**: After any secondary steps (e.g., signing/submission) are complete.

A single Policy can implement hooks for **all** of these stages if needed. If a Policy determines that an action violates its rules, it throws an error, effectively blocking the tool execution.

## Creating a Policy

To create a new policy, extend the `Policy` class and implement the abstract properties and any of the `shouldBlock...` methods.

### The `Policy` Class

The `Policy` class simplifies the hook implementation by providing specific methods for validation:

-   `shouldBlockPreToolExecution`
-   `shouldBlockPostParamsNormalization`
-   `shouldBlockPostCoreAction`
-   `shouldBlockPostSecondaryAction`

**Note:** You should only override these `shouldBlock...` methods. The underlying hook methods (e.g., `preToolExecutionHook`) are handled internally to ensure consistent error handling.

### Example: Token Allowlist Policy

```typescript
import { Policy, PostParamsNormalizationParams, Context } from 'hedera-agent-kit';

export class TokenAllowlistPolicy extends Policy {
  public name = 'Token Allowlist';
  public description = 'Only allows interactions with specific Token IDs';
  
  // Define which tools this policy applies to
  public relevantTools = [
    'transfer_fungible_token_tool',
    'mint_non_fungible_token_tool',
    // ... add other relevant tool names
  ];

  private allowedTokens: Set<string>;

  constructor(allowedTokens: string[]) {
    super();
    this.allowedTokens = new Set(allowedTokens);
  }

  // Override the specific validation step you need
  protected shouldBlockPostParamsNormalization(
    _context: Context,
    validationParams: PostParamsNormalizationParams,
  ): boolean {
    const params = validationParams.normalisedParams;
    
    // Check if the token ID in params is allowed
    if (params.tokenId && !this.allowedTokens.has(params.tokenId.toString())) {
      return true; // Return true to BLOCK the execution
    }

    return false; // Return false to ALLOW
  }
}
```

## Advanced Usage

### 1. `AbstractHook` and Future Flexibility

Policies extend `AbstractHook`. Currently, `AbstractHook` serves as the base for all interception logic. In the future, a more generalized `Hook` class may be introduced to allow for even greater flexibility, such as modifying execution flow without just blocking it, or injecting custom logic that isn't strictly a "policy".

### 2. Communication Between Hooks

Hooks are stateless by default, but you can share data between different hooks (or even different execution stages of the same hook) using the `Context` object.

The `Context` is passed to every hook method. You can attach custom properties to it if you need to persist information across the lifecycle of a single tool execution.

```typescript
// Example: Storing a timestamp in Pre-Exec and checking it in Post-Exec
protected async shouldBlockPreToolExecution(context: Context, ...): Promise<boolean> {
  context.customData = { startTime: Date.now() };
  return false;
}

protected async shouldBlockPostCoreAction(context: Context, ...): Promise<boolean> {
  const duration = Date.now() - context.customData.startTime;
  console.log(`Tool took ${duration}ms`);
  return false;
}
```

### 3. Handling Types with Zod

One challenge with generic policies is handling the `params` object, which can vary significantly between tools. Since `params` is often `any` or a loose type in the hook signature, it's highly recommended to use **Zod** schemas to inspect and validate the structure of parameters safely at runtime.

```typescript
import { z } from 'zod';

const TransferParamsSchema = z.object({
  amount: z.number().max(100),
  recipientId: z.string(),
}).passthrough(); // Allow other properties

// In your policy:
const result = TransferParamsSchema.safeParse(params);
if (result.success) {
    // Validated typed access
    if (result.data.amount > 50) return true; 
}
```

## Example Usage

You can find a complete, runnable example of using various policies in the examples directory:

-   **File**: `typescript/examples/policy-example/index.ts`

This example demonstrates how to configure an agent with multiple policies like `RequiredMemoPolicy`, `MaxHbarTransferPolicy`, and `ImmutabilityPolicy`.
