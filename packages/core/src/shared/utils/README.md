# Hedera Agent Kit Utilities

This directory contains utility classes for consistent account resolution and prompt generation across the Hedera Agent Kit.

## AccountResolver

The `AccountResolver` class provides centralized account resolution logic that's aware of the agent's operational mode.

### Key Features:

- **Mode-aware resolution**: In `RETURN_BYTES` mode, prefers `context.accountId` (user's account). In `AUTONOMOUS` mode, prefers the operator account.
- **Fallback handling**: Automatically falls back to appropriate accounts when specific accounts aren't provided.
- **Consistent behavior**: Eliminates duplicate account resolution logic across tools.

### Usage:

```typescript
import { AccountResolver } from './account-resolver';

// Get the default account for the current context and mode
const defaultAccount = AccountResolver.getDefaultAccount(context, client);

// Resolve an account with fallback to default
const resolvedAccount = AccountResolver.resolveAccount(params.accountId, context, client);
```

## PromptGenerator

The `PromptGenerator` class provides standardized prompt generation for tools, ensuring consistent messaging about account resolution and parameter usage.

### Key Features:

- **Context-aware prompts**: Generates different prompts based on agent mode and context.
- **Standardized parameter descriptions**: Consistent descriptions for account parameters.
- **Mode-specific instructions**: Clear guidance about which account will be used by default.

### Usage:

```typescript
import { PromptGenerator } from './prompt-generator';

const prompt = (context: Context) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool does something useful.

Parameters:
- ${accountDesc}
- otherParam (str, optional): Some other parameter
${usageInstructions}
`;
};
```

## Benefits

1. **Centralized Logic**: Account resolution is handled in one place, eliminating duplication.
2. **Mode Awareness**: Tools automatically adapt their behavior based on the agent's operational mode.
3. **Consistent Messaging**: All tools provide the same clear guidance about account resolution.
4. **Maintainability**: Changes to account resolution logic only need to be made in one place.
5. **Clear Documentation**: LLMs receive consistent, mode-specific instructions about account behavior.

## Agent Modes

### AUTONOMOUS Mode

- Agent executes transactions directly using its operator account
- Default account: operator account
- User account (if specified in context) is noted but not used by default

### RETURN_BYTES Mode

- Agent prepares transactions for user signing
- Default account: user account (from context.accountId)
- Falls back to operator account if user account not specified

This ensures that in `RETURN_BYTES` mode, transactions are prepared with the user's account as the default, while in `AUTONOMOUS` mode, the agent's operator account is used.
