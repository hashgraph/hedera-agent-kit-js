# Available Hedera Plugins

The Hedera Agent Kit provides a comprehensive set of tools organized into **plugins**, which can be installed alongside the Hedera Agent Kit and used to extend the core funcitonality of the Hederak Agent Kit SDK.
These tools can be used both by the conversational agent and when you are building with the SDK.

The Hedera services built into this agent toolkit are also implemented as plugins, you can see a description of each plugin in the [HEDERAPLUGINS.md](HEDERAPLUGINS.md) file, as well as list of the individual tools for each Hedera service that are included in each plugin.

## Available Third Party Plugins

- [Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin) provides a streamlined interface to the [**memejob**](https://memejob.fun/) protocol, exposing the core actions (`create`, `buy`, `sell`) for interacting with meme tokens on Hedera:

  Github repository: https://github.com/buidler-labs/hak-memejob-plugin

## Plugin Architecture

The tools are now organized into plugins, each containing a set functionality related to the Hedera service or project they are created for.

## Creating a Plugin

### Plugin Interface

Every plugin must implement the Plugin interface:

```typescript
export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  tools: (context: Context) => Tool[];
}
```

### Tool Interface

Each tool must implement the Tool interface:

```typescript
export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
};
```

### Step-by-Step Guide

**Step 1: Create Plugin Directory Structure**

```typescript
  my-custom-plugin/
  ├── index.ts                    # Plugin definition and exports
  ├── tools/
  │   └── my-service/
  │       └── my-tool.ts         # Individual tool implementation
```

**Step 2: Implement Your Tool**

Create your tool file (e.g., tools/my-service/my-tool.ts):

```typescript
import { z } from "zod";
import { Context, Tool, handleTransaction } from "hedera-agent-kit";
import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define parameter schema
const myToolParameters = (context: Context = {}) =>
  z.object({
    requiredParam: z.string().describe("Description of required parameter"),
    optionalParam: z
      .string()
      .optional()
      .describe("Description of optional parameter"),
  });

// Create prompt function
const myToolPrompt = (context: Context = {}) => {
  return `
  This tool performs a specific operation.

  Parameters:
  - requiredParam (string, required): Description
  - optionalParam (string, optional): Description
  `;
};

// Implement tool logic
const myToolExecute = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof myToolParameters>>,
) => {
  try {
    // Your implementation here
    const result = await someHederaOperation(params);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return "Operation failed";
  }
};

export const MY_TOOL = "my_tool";

const tool = (context: Context): Tool => ({
  method: MY_TOOL,
  name: "My Custom Tool",
  description: myToolPrompt(context),
  parameters: myToolParameters(context),
  execute: myToolExecute,
});

export default tool;
```

**Step 3: Create Plugin Definition**

Create your plugin index file (index.ts):

```typescript
  import { Context } from '@/shared';
  import { Plugin } from '@/shared/plugin';
  import myTool, { MY_TOOL } from './tools/my-service/my-tool';

  export const myCustomPlugin: Plugin = {
    name: 'my-custom-plugin',
    version: '1.0.0',
    description: 'A plugin for custom functionality',
    tools: (context: Context) => {
      return [myTool(context)];
    },
  };

  export const myCustomPluginToolNames = {
    MY_TOOL,
  } as const;

  export default { myCustomPlugin, myCustomPluginToolNames };

  Step 4: Register Your Plugin

  Add your plugin to the main plugins index (src/plugins/index.ts):

  import { myCustomPlugin, myCustomPluginToolNames } from './my-custom-plugin';

  export {
    // ... existing exports
    myCustomPlugin,
    myCustomPluginToolNames,
  };
```

### Best Practices

**Parameter Validation**

- Use Zod schemas for robust input validation
- Provide clear descriptions for all parameters
- Mark required vs optional parameters appropriately

**Tool Organization**

- Group related tools by service type
- Use consistent naming conventions
- Follow the established directory structure

**Transaction Handling**

- Use handleTransaction() to facilitate human-in-the-loop and autonomous execution flows
- Respect the AgentMode (AUTONOMOUS vs RETURN_BYTES)
- Implement proper transaction building patterns

### Using Your Custom Plugin

```typescript
import { HederaLangchainToolkit } from "hedera-agent-kit";
import {
  myCustomPlugin,
  myCustomPluginToolNames,
} from "./plugins/my-custom-plugin";

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    tools: [myCustomPluginToolNames.MY_TOOL],
    plugins: [myCustomPlugin],
    context: {
      mode: AgentMode.AUTONOMOUS,
    },
  },
});
```

### Examples and References

- See existing core plugins in typescript/src/plugins/core-\*-plugin/
- Follow the patterns established in tools like [transfer-hbar.ts](typescript/src/plugins/core-account-plugin/tools/account/transfer-hbar.ts)
- See [typescript/examples/langchain/tool-calling-agent.ts](typescript/examples/langchain/tool-calling-agent.ts) for usage examples

## Publish and Register Your Plugin

To create a plugin to be use with the Hedera Agent Kit, you will need to create a plugin in your own repository, publish an npm package, and provide a description of the functionality included in that plugin, as well as the required and optional parameters.

Once you have a repository, published npm package, and a README with a description of the functionality included in that plugin in your plugin's repo, as well as the required and optional parameters, you can add it to the Hedera Agent Kit by forking and opening a Pull Request to:

1. Include the plugin as a bullet point under the **Available Third Party Plugin** section _on this page_. Include the name, a brief description, and a link to the repository with the README, as well the URL linked to the published npm package.

2. Include the same information **in the README.md of this repository** under the **Third Party Plugins** section.

3. If you would like to include your plugin functionality in the Hedera plugin built for ElizaOS simply make a PR to [add your plugin name to the `plugins` array in the Hedera ElizaOS plugin](https://github.com/elizaos-plugins/plugin-hedera/blob/1.x/src/adapter-plugin/plugin.ts#L72) where the configuration is initiated. The hedera-agent-kit adaptor architecture means your plugin functionality will be usable with no additional configuration needed.

Feel free to also [reach out to the Hedera Agent Kit maintainers on Discord](https://hedera.com/discord) or another channel so we can test out your plugin, include it in our docs, and let our community know thorough marketing and community channels.

Please also reach out in the Hedera Discord in the Support > developer-help-desk channelor create an Issue in this repository for help building, publishing, and promoting your plugin

## Plugin README Template

```markdown
## Plugin Name

This plugin was built by <?> for the <project, platform, etc>. It was built to enable <who?> to <do what?>

<Include a description of your project and how it can be used with the Hedera Agent Kit.>

### Installation

'''bash
npm install <plugin-name>
'''


### Usage

'''javascript
import { myPlugin } from "<plugin-name>";
'''

'''javascript
const hederaAgentToolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    context: {
      mode: AgentMode.AUTONOMOUS,
    },
    plugins: [
      coreTokenPlugin,
      coreAccountPlugin,
      coreConsensusPlugin,
      coreQueriesPlugin,
      myPlugin,
    ],
  },
});
'''

### Functionality

Describe the different tools or individual pieces of functionality included in this plugin, and how to use them.

**Plugin Name**
_High level description of the plugin_

| Tool Name               | Description  | Usage                                                           |
| ----------------------- | ------------ | --------------------------------------------------------------- |
| `YOUR_PLUGIN_TOOL_NAME` | What it does | How to use. Include a list of parameters and their descriptions |

```
