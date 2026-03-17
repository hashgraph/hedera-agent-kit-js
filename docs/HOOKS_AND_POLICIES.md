# Agent Hooks and Policies

The Hedera Agent Kit provides a flexible and powerful system for extending tool behavior and enforcing business logic
through **Hooks** and **Policies**.

---

## Table of Contents

### Part 1: For Hooks and Policies Users
- [Quick Overview](#quick-overview)
- [When Hooks and Policies are Called](#when-hooks-and-policies-are-called)
- [How to Use Hooks and Policies](#how-to-use-hooks-and-policies)
- [Available Hooks and Policies](#available-hooks-and-policies)
  - [HcsAuditTrailHook](#1-hcsaudittrailhook-hook)
  - [MaxRecipientsPolicy](#2-maxrecipientspolicy-policy)
  - [RejectToolPolicy](#3-rejecttoolpolicy-policy)

### Part 2: For Policy and Hook Developers
- [Tool Lifecycle Deep Dive](#tool-lifecycle-deep-dive)
- [Hook Parameter Structures](#hook-parameter-structures)
- [Hooks vs. Policies](#hooks-vs-policies)
- [Type Safety & Multi-Tool Context](#type-safety--multi-tool-context)
- [Creating New Hooks/Policies](#creating-new-hookspolicies)
- [Adding to the Registry](#-how-to-add-to-this-registry)

---

# Part 1: For Hooks and Policies Users

## Quick Overview

**Hooks** and **Policies** let you customize how tools behave:

- **Hooks**: Extensions that observe and modify tool execution (logging, tracking, etc.)
- **Policies**: Validation rules that can **block** tool execution if certain conditions aren't met

> [!NOTE]
> Only tools extending `BaseTool` support hooks and policies. Tools that directly implement the `Tool` interface do not.

## When Hooks and Policies are Called

Hooks can execute at 4 different points during a tool's lifecycle:

1. **Pre-Tool Execution** - Before anything happens
2. **Post-Parameter Normalization** - After parameters are validated and cleaned
3. **Post-Core Action** - After the main logic executes (e.g., transaction created)
4. **Post-Tool Execution** - After everything completes (e.g., transaction submitted)

## How to Use Hooks and Policies

Add hooks and policies to your agent's context during initialization:

```typescript
import { HcsAuditTrailHook, MaxRecipientsPolicy, RejectToolPolicy } from '@hashgraph/hedera-agent-kit';

const context = {
  hooks: [
    new HcsAuditTrailHook(['transfer_hbar'], '0.0.12345'),
    new MaxRecipientsPolicy(5),
    new RejectToolPolicy(['delete_account']),
  ],
  // ... other configuration
};
```

> [!TIP]
> **Example Project**: See [`typescript/examples/adk/audit-hook-agent.ts`](../typescript/examples/adk/audit-hook-agent.ts) for a complete working example of the HcsAuditTrailHook

## Available Hooks and Policies

### 1. `HcsAuditTrailHook` (Hook)

**Description**:  
Provides an immutable audit trail by logging tool executions to a Hedera Consensus Service (HCS) topic.

> [!IMPORTANT]  
> **Autonomous Mode Only**: This hook is strictly available in `AUTONOMOUS` mode. It will throw an error if used in
`RETURN_BYTES` mode.

> [!WARNING]  
> **HIP-991 (Paid Topics)**: If a paid topic is used, it will incur submission fees. Ensure the `loggingClient` has
> sufficient funds to avoid draining the account.

**Prerequisites**:

1. **Topic Creation**: The HCS topic must be created before initializing the hook.
2. **Permissions**: The Hedera account associated with the `loggingClient` (or the agent's operator account) must have
   permissions to submit messages to the topic (i.e., it must hold the `submitKey` if one is defined).

**Parameters**:

- `relevantTools`: `string[]` - List of tools to audit (e.g., `['transfer_hbar', 'create_token']`).
- `hcsTopicId`: `string` - The pre-created Hedera topic ID (e.g., `'0.0.12345'`).
- `loggingClient?`: `Client` - (Optional) A separate Hedera client for logging. If not provided, defaults to the agent's operator client. Must have submission access to the topic.

**Example Usage**:

```typescript
import { HcsAuditTrailHook } from '@hashgraph/hedera-agent-kit/hooks';

const auditHook = new HcsAuditTrailHook(
  ['transfer_hbar', 'create_token'],
  '0.0.12345' // Ensure this topic exists and the agent can post to it
);

// Add to your agent configuration
const context = {
  hooks: [auditHook],
  // ...
};
```

> [!NOTE]
> **Complete Example**: See [`typescript/examples/adk/audit-hook-agent.ts`](../typescript/examples/adk/audit-hook-agent.ts) for a full working implementation.

---

### 2. `MaxRecipientsPolicy` (Policy)

**Description**:  
A security policy that limits the number of recipients in transfer and airdrop operations. It blocks requests that
exceed a defined threshold to prevent massive unauthorized transfers.

**Default Supported Tools**:
By default, the policy knows how to count recipients for:

- `transfer_hbar`
- `transfer_hbar_with_allowance`
- `airdrop_fungible_token`
- `transfer_fungible_token_with_allowance`
- `transfer_non_fungible_token`
- `transfer_non_fungible_token_with_allowance`

**Parameters**:

- `maxRecipients`: `number` - Maximum number of recipients allowed.
- `additionalTools?`: `string[]` - (Optional) Extra tools to apply this policy to.
- `customStrategies?`: `Record<string, (params: any) => number>` - (Optional) A mapping of tool names to functions that count recipients. **If you add tools via `additionalTools`, you must provide a strategy for each one**, otherwise the policy will throw an error at runtime.

**Example with Custom Strategies**:

```typescript
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';

// Basic usage with default tools only
const basicPolicy = new MaxRecipientsPolicy(5);

// With custom tool - strategy is REQUIRED
const extendedPolicy = new MaxRecipientsPolicy(
  5, // max 5 recipients
  ['my_custom_bulk_tool'], // additional tool
  {
    // This strategy is required for the custom tool
    'my_custom_bulk_tool': (params) => params.recipients.length
  }
);
```

---

### 3. `RejectToolPolicy` (Policy)

**Description**:
A restrictive policy used to explicitly disable specific tools. Even if a tool is technically available in a plugin,
this policy ensures the agent cannot execute it under any circumstances.

**Parameters**:

- `relevantTools`: `string[]` - The list of tool methods to be blocked (e.g., `['delete_account', 'freeze_token']`).

**Example Usage**:

```typescript
import { RejectToolPolicy } from '@hashgraph/hedera-agent-kit/policies';

const safetyPolicy = new RejectToolPolicy(['delete_account']);

const context = {
  hooks: [safetyPolicy],
  // ...
};
```

---

# Part 2: For Policy and Hook Developers

## Tool Lifecycle Deep Dive

Every tool in the kit follows a standardized 7-stage lifecycle. The execution logic is defined in
`typescript/src/shared/tools.ts`.

```text
[1. Pre-Tool Execution] --------> Hook: preToolExecutionHook
         |
[2. Parameter Normalization]
         |
[3. Post-Parameter Normalization] --> Hook: postParamsNormalizationHook
         |
[4. Core Action]
         |
[5. Post-Core Action] --------------> Hook: postCoreActionHook
         |
[6. Secondary Action]
         |
[7. Post-Tool Execution] -----------> Hook: postToolExecutionHook
         |
[Result Returned]
```

**Stage Details:**

1. **Pre-Tool Execution**: Before any processing begins. Use for early validation or logging.
2. **Parameter Normalization**: The tool validates and cleans user input (not hookable).
3. **Post-Parameter Normalization**: After parameters are normalized. Use for parameter-based validation.
4. **Core Action**: Primary business logic executes (e.g., creating a transaction).
5. **Post-Core Action**: After core logic completes. Use to inspect or modify the result before submission.
6. **Secondary Action**: Transaction signing/submission happens (not hookable).
7. **Post-Tool Execution**: After everything completes. Use for final logging or cleanup.

## Hook Parameter Structures

Each hook receives specialized parameter objects and the **`method`** name (string) representing the tool being
executed. This allows hooks to target specific tools or apply general logic.

| Hook Stage                      | Available Data (via params object)                                                     | Additional Parameters | Use Case                                     |
|:--------------------------------|:---------------------------------------------------------------------------------------|:----------------------|:---------------------------------------------|
| `preToolExecutionHook`          | `context`, `rawParams`, `client`                                                       | `method`, `client`    | Early validation, logging initial state      |
| `postParamsNormalizationHook`   | `context`, `rawParams`, `normalisedParams`, `client`                                   | `method`, `client`    | Parameter-based policies, data enrichment    |
| `postCoreActionHook`            | `context`, `rawParams`, `normalisedParams`, `coreActionResult`, `client`               | `method`, `client`    | Inspect/modify transaction before submission |
| `postToolExecutionHook`         | `context`, `rawParams`, `normalisedParams`, `coreActionResult`, `toolResult`, `client` | `method`, `client`    | Final logging, audit trails, cleanup         |

> [!TIP]
> Use the `method` parameter to filter execution and apply **Type Guards** for safe parameter access.

---

## Hooks vs. Policies

### Hooks (`AbstractHook`)

Hooks are **non-blocking extensions** that observe and modify execution flow. They can:
- Log data
- Modify context state
- Enrich parameters
- Track metrics

They should not stop execution unless an error occurs.

**Example**: `HcsAuditTrailHook` logs execution details to an HCS topic without blocking.

### Policies (`Policy`)

Policies are specialized Hooks designed to **validate** and **block** execution. They use `shouldBlock...` methods that return boolean values. If `true` is returned, the `Policy` base class throws an error, immediately halting the tool's lifecycle.

**Policy Execution Flow:**

```text
[Stage: Pre-Tool Execution]
         |
    (Hook Entry)
         |
    [Policy.preToolExecutionHook] (calls shouldBlockPreToolExecution)
         |
    [shouldBlockPreToolExecution?] -- Yes --> [THROW ERROR] --> (Error returned to LLM/Agent)
         |
         No
         |
[Proceed to Normalization Stage]
```

> [!IMPORTANT]
> **Policy Implementation Rule**: When creating a custom Policy, you **should** define logic in at least one of the `shouldBlock...`
> methods (e.g., `shouldBlockPreToolExecution`, `shouldBlockPostParamsNormalization`, etc.). While the tool won't break if they are undefined, the policy won't perform any blocking logic. You **must not** override the native hook methods (e.g., `preToolExecutionHook`) as the `Policy` base class uses these internally to trigger the blocking logic and throw errors.

**Available `shouldBlock...` methods:**
- `shouldBlockPreToolExecution()`
- `shouldBlockPostParamsNormalization()`
- `shouldBlockPostCoreAction()`
- `shouldBlockPostSecondaryAction()`

> [!NOTE]
> Every `Policy` is an `AbstractHook`, but with pre-defined error handling and "block check" methods.

---

## Type Safety & Multi-Tool Context

Hooks are configured for a specific set of tools (the `relevantTools` list). However, because `AbstractHook` is generic,
there is **no compile-time type safety** for parameters. When a hook targets multiple tools, you must handle the various
parameter structures using one of three patterns:

### 1. Universal Logic

**When to use:**
- Your hook performs the same operation across all tools
- Target tools share common parameter fields (e.g., `transfers`, `tokenId`)
- Logic is independent of parameters (e.g., counting tool calls)

**Approach**: Focus on the `context` for state management or apply generic processing (like recursive stringification) to `rawParams`.

**Example**: `HcsAuditTrailHook` logs all inputs to HCS without needing to know each tool's schema.

```typescript
async postToolExecutionHook(context: Context, params: PostSecondaryActionParams, method: string) {
  // Works for all tools - generic logging
  const logEntry = {
    tool: method,
    timestamp: Date.now(),
    params: JSON.stringify(params.rawParams),
  };
  await this.logToHCS(logEntry);
}
```

### 2. Conditional Logic (Type Guards)

**When to use:**
- Your hook targets a small, known set of tools
- You need to access specific parameters
- Different tools require different handling

**Approach**: Check the `method` parameter and use **Type Guards** or safe casting.

**Example**:

```typescript
public async postParamsNormalizationHook(
  context: Context,
  params: PostParamsNormalizationParams,
  method: string
): Promise<any> {
  // Filter and branch based on the tool
  switch (method) {
    case 'transfer_hbar':
    case 'transfer_hbar_with_allowance': {
      // Both tools share the 'transfers' structure
      const p = params.normalisedParams as { transfers: Array<{to: string, amount: number}> };

      // Example: Log total transfer amount
      const total = p.transfers.reduce((sum, t) => sum + t.amount, 0);
      console.log(`Total HBAR being transferred: ${total}`);
      break;
    }
    case 'create_account': {
      const p = params.normalisedParams as { initialBalance: number };
      console.log(`Creating account with balance: ${p.initialBalance}`);
      break;
    }
  }
}
```

### 3. Strategy Pattern (Dependency Injection)

**When to use:**
- Your hook/policy needs to support "unknown" custom tools
- You want maximum extensibility
- Users should be able to extend your hook's behavior

**Approach**: Accept a **Strategy Map** (Record) during initialization that maps tool names to handling functions.

**Example**: `MaxRecipientsPolicy` uses a `customStrategies` map:

```typescript
export class MaxRecipientsPolicy extends Policy {
  constructor(
    private maxRecipients: number,
    additionalTools: string[] = [],
    private customStrategies: Record<string, (params: any) => number> = {}
  ) {
    super();
    this.relevantTools = [...this.defaultTools, ...additionalTools];

    // Validate that all additional tools have strategies
    for (const tool of additionalTools) {
      if (!this.customStrategies[tool]) {
        throw new Error(`Custom tool "${tool}" requires a strategy function`);
      }
    }
  }

  protected async shouldBlockPostParamsNormalization(
    context: Context,
    params: PostParamsNormalizationParams,
    method: string
  ): Promise<boolean> {
    let recipientCount: number;

    // Use custom strategy if provided
    if (this.customStrategies[method]) {
      recipientCount = this.customStrategies[method](params.normalisedParams);
    } else {
      // Use default counting logic
      recipientCount = this.countRecipientsDefault(method, params.normalisedParams);
    }

    return recipientCount > this.maxRecipients;
  }
}
```

**Usage:**

```typescript
const policy = new MaxRecipientsPolicy(
  5, // max 5 recipients
  ['my_custom_bulk_send'], // additional tool
  {
    'my_custom_bulk_send': (params) => params.recipients.length
  }
);
```

---

## Creating New Hooks/Policies

### Template for New Hook

```typescript
import { AbstractHook, Context, PreToolExecutionParams, PostParamsNormalizationParams, PostCoreActionParams, PostSecondaryActionParams } from '@/shared';
import { Client } from '@hashgraph/sdk';

export class MyCustomHook extends AbstractHook {
  name = 'My Custom Hook';
  description = 'Detailed explanation of what this hook does';
  relevantTools = ['create_account', 'transfer_hbar']; // List specific tools

  // Implement any of the 4 hook methods you need:

  async preToolExecutionHook(context: Context, params: PreToolExecutionParams, method: string, client: Client) {
    // Early in the lifecycle - before parameter normalization
    if (!this.relevantTools.includes(method)) return;

    // Access client via parameter or params object
    const hederaClient = client; // or params.client (both are the same)

    // Your logic here
  }

  async postParamsNormalizationHook(context: Context, params: PostParamsNormalizationParams, method: string, client: Client) {
    // After parameters are validated and cleaned
    if (!this.relevantTools.includes(method)) return;

    // Access normalized parameters
    const normalizedParams = params.normalisedParams;

    // Your logic here
  }

  async postCoreActionHook(context: Context, params: PostCoreActionParams, method: string, client: Client) {
    // After main logic (e.g., transaction created but not submitted)
    if (!this.relevantTools.includes(method)) return;

    // Access the core action result (e.g., the transaction object)
    const txResult = params.coreActionResult;

    // Your logic here
  }

  async postToolExecutionHook(context: Context, params: PostSecondaryActionParams, method: string, client: Client) {
    // After everything completes
    if (!this.relevantTools.includes(method)) return;

    // Access the final tool result
    const finalResult = params.toolResult;

    // Your logic here
  }
}
```

**Best Practices:**

1. **Naming**: Use descriptive names ending in `Hook`
2. **Description**: Clearly explain what the hook does and when to use it
3. **Error Handling**: Wrap your logic in try-catch to avoid breaking tool execution
4. **Performance**: Keep hook logic lightweight
5. **State**: Use `context` object to persist data across hook invocations

### Template for New Policy

```typescript
import { Policy, Context, PreToolExecutionParams, PostParamsNormalizationParams, PostCoreActionParams, PostSecondaryActionParams } from '@/shared';

export class MyCustomPolicy extends Policy {
  name = 'My Custom Policy';
  description = 'Detailed explanation of what this policy blocks';
  relevantTools = ['transfer_hbar', 'transfer_fungible_token'];

  // Implement at least one of the shouldBlock... methods for the policy to function
  // Return true to BLOCK execution, false to ALLOW
  // These methods can return boolean or Promise<boolean>

  protected shouldBlockPreToolExecution(
    context: Context,
    params: PreToolExecutionParams,
    method: string
  ): boolean | Promise<boolean> {
    // Block based on raw parameters (before normalization)
    const { rawParams } = params;

    // Example: block specific accounts
    // return rawParams.accountId === '0.0.blocked';

    return false;
  }

  protected shouldBlockPostParamsNormalization(
    context: Context,
    params: PostParamsNormalizationParams,
    method: string
  ): boolean | Promise<boolean> {
    // Block based on normalized parameters
    const { normalisedParams } = params;

    // Example: block if amount > 1000
    if ('amount' in normalisedParams) {
      return normalisedParams.amount > 1000;
    }

    return false;
  }

  protected shouldBlockPostCoreAction(
    context: Context,
    params: PostCoreActionParams,
    method: string
  ): boolean | Promise<boolean> {
    // Block based on the result of core action
    const { coreActionResult } = params;

    // Example: inspect the created transaction
    // return someValidationOn(coreActionResult);

    return false;
  }

  protected shouldBlockPostSecondaryAction(
    context: Context,
    params: PostSecondaryActionParams,
    method: string
  ): boolean | Promise<boolean> {
    // Block based on final result (rarely used)
    const { toolResult } = params;

    return false;
  }
}
```

**Best Practices:**

1. **Naming**: Use descriptive names ending in `Policy`
2. **Error Messages**: The `Policy` base class will create error messages. For custom messages, you can throw your own error in the `shouldBlock...` method
3. **Specificity**: Be specific about what conditions trigger blocking
4. **Documentation**: Clearly document what conditions will block execution
5. **Performance**: Keep validation logic fast
6. **Return Values**: Always return a boolean (true = block, false = allow)

**Common Policy Patterns:**

```typescript
// 1. Threshold Policy
protected shouldBlockPostParamsNormalization(
  context: Context,
  params: PostParamsNormalizationParams,
  method: string
): boolean {
  return params.normalisedParams.amount > this.maxAmount;
}

// 2. Allowlist/Blocklist Policy
protected shouldBlockPreToolExecution(
  context: Context,
  params: PreToolExecutionParams,
  method: string
): boolean {
  return this.blockedAccounts.includes(params.rawParams.accountId);
}

// 3. Time-based Policy
protected shouldBlockPreToolExecution(
  context: Context,
  params: PreToolExecutionParams,
  method: string
): boolean {
  const hour = new Date().getHours();
  return hour < 9 || hour > 17; // Block outside business hours
}

// 4. Rate Limiting Policy (using context)
protected shouldBlockPreToolExecution(
  context: Context,
  params: PreToolExecutionParams,
  method: string
): boolean {
  const callCount = (context.state.callCount || 0) + 1;
  context.state.callCount = callCount;
  return callCount > this.maxCallsPerSession;
}
```

---

## 📝 How to Add to this Registry

When adding a new Hook or Policy:

1. **Implementation**: Add the implementation file to `typescript/src/hooks` or `typescript/src/policies`
2. **Export**: Export it from the appropriate index file
3. **Documentation**: Add a new section in [Part 1: Available Hooks and Policies](#available-hooks-and-policies) with:
   - Name and Type (Hook or Policy)
   - Description
   - Prerequisites (if any)
   - Configuration Parameters
   - Example Usage
4. **Testing**: Add unit, integration and e2e tests in the corresponding test directory
5. **Update**: Ensure your `relevantTools` are clearly defined
