# Hedera Agent Kit Plugin System

This directory contains examples of how to create custom plugins for the Hedera Agent Kit.

## What are Plugins?

Plugins are a way to extend the Hedera Agent Kit with custom tools without modifying the core codebase. Each plugin is a logical grouping of tools that can be easily shared and reused across different projects.

## Plugin Structure

A plugin must implement the `Plugin` interface:

```typescript
interface Plugin {
  name: string;           // Unique plugin identifier
  version?: string;       // Optional version string
  description?: string;   // Optional description
  tools: (context: Context) => Tool[];  // Factory function that returns tools
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string }; // optional output parser. Used by ResponseParserService in langchain adapter. Recommended for LangChain v1
}
```

### LangChain v1 Support

For LangChain v1, tools should provide an `outputParser` to structure the tool output correctly. This is defined in the `Tool` interface in [typescript/src/shared/tools.ts](../../src/shared/tools.ts).

You can use the default `transactionToolOutputParser` for tools that execute Hedera transactions. This parser is available in [typescript/src/shared/utils/default-tool-output-parsing.ts](../../src/shared/utils/default-tool-output-parsing.ts).

If you don't provide an `outputParser`, a default one will be used, but providing a specific one ensures better handling of transaction results and errors.

## Creating a Plugin

1. **Import Required Types**:
```typescript
import { Plugin, Context, Tool } from 'hedera-agent-kit';
import { z } from 'zod';
```

2. **Create Tool Functions**:
Each tool should follow the `Tool` interface:
```typescript
const createMyTool = (context: Context): Tool => ({
  method: 'my_tool_name',
  name: 'My Tool Display Name',
  description: 'Tool description with parameters and usage info',
  parameters: z.object({
    param1: z.string().min(1, 'Parameter is required'),
    param2: z.boolean().optional().default(false),
  }),
  execute: async (client: Client, context: Context, params: any) => {
    // Your tool implementation
    return 'Tool result';
  },
  outputParser: undefined, // Optional: Define a custom parser or use transactionToolOutputParser for LangChain v1
});
```

3. **Export Your Plugin**:
```typescript
export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin description',
  tools: (context: Context) => [
    createMyTool(context),
    // ... other tools
  ],
};
```

## Using Plugins

To use plugins in your application:

```typescript
import { HederaAIToolkit } from 'hedera-agent-kit';
import { myPlugin } from './my-plugin';

const toolkit = new HederaAIToolkit({
  client,
  configuration: {
    tools: [
      // Core tools
      'create_fungible_token_tool',
      // Plugin tools
      'my_tool_name',
    ],
    plugins: [myPlugin], // Add your plugins here
    context: {
      mode: AgentMode.AUTONOMOUS,
    },
  },
});
```

## Tool Naming and Conflicts

- Plugin tools should use descriptive, unique names to avoid conflicts
- If a plugin tool has the same name as a core tool, the core tool takes precedence
- Consider prefixing your tools with your plugin name (e.g., `myPlugin_greeting_tool`)

## Best Practices

1. **Error Handling**: Always wrap tool execution in try-catch blocks
2. **Parameter Validation**: Use Zod schemas for robust parameter validation
3. **Documentation**: Provide clear descriptions and parameter documentation
4. **Context Usage**: Leverage the context parameter for configuration and state
5. **Async Operations**: Use async/await for Hedera SDK operations
6. **Logging**: Include appropriate logging for debugging

## Examples

See `example-plugin.ts` for a complete working example that demonstrates:
- Simple tools with parameter validation (greeting tool)
- Real Hedera transactions using the transaction strategy pattern (HBAR transfer tool)
- Proper error handling and validation
- Integration with Hedera Agent Kit utilities (PromptGenerator, handleTransaction)
- Support for different operation modes (AUTONOMOUS vs RETURN_BYTES)

## Distribution

Plugins can be distributed as:
- NPM packages
- Standalone TypeScript files
- Part of larger application codebases

When creating NPM packages, ensure you:
- Export the plugin as the default export
- Include proper TypeScript definitions
- List `hedera-agent-kit` as a peer dependency
- Follow semantic versioning