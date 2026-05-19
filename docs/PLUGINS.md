# Available Hedera Plugins

The Hedera Agent Kit provides a comprehensive set of tools organized into **plugins**, which can be installed alongside the Hedera Agent Kit and used to extend the core functionality of the Hedera Agent Kit SDK.
These tools can be used both by the conversational agent and when you are building with the SDK.

The Hedera services built into this agent toolkit are also implemented as plugins, you can see a description of each plugin in the [HEDERAPLUGINS.md](HEDERAPLUGINS.md) file, as well as list of the individual tools for each Hedera service that are included in each plugin.

## Available Third Party Plugins

See this list of available third party plugins for the Hedera Agent Kit in the [Hedera Docs](https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-ai-agent-kit/plugins#plugins).


- [Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin) provides a streamlined interface to the [**memejob**](https://memejob.fun/) protocol, exposing the core actions (`create`, `buy`, `sell`) for interacting with meme tokens on Hedera:

  NPM: https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin

  Github repository: https://github.com/buidler-labs/hak-memejob-plugin

  Version: @buidlerlabs/hak-memejob-plugin@1.1.0

  Status: Validated by HAK team, v4-compatible release 


- [Bonzo Plugin](https://www.npmjs.com/package/@bonzofinancelabs/hak-bonzo-plugin) is a unified SDK to the [**Bonzo**](https://bonzo.finance) protocol, exposing the core actions (`deposit`, `withdraw`, `repay`, `borrow`) for decentralised lending and borrowing on Hedera:

  NPM: https://www.npmjs.com/package/@bonzofinancelabs/hak-bonzo-plugin

  Github repository: https://github.com/Bonzo-Labs/bonzoPlugin

  Version: @bonzofinancelabs/hak-bonzo-plugin@1.0.1

  Status: Not validated by HAK team, v3-compatible release  


- [SaucerSwap Labs Plugin](https://www.npmjs.com/package/saucer-swap-plugin) provides a streamlined interface to the [**SaucerSwap**](https://saucerswap.finance) DEX, exposing the core actions (`get_swap_quote_v2_tool`, `swap_v2_tool`) for executing swaps and obtaining swap quotes.

  NPM: https://www.npmjs.com/package/saucer-swap-plugin

  Github repository: https://github.com/saucerswaplabs/hedera-agent-kit-saucer-swap-plugin

  Version: saucer-swap-plugin@0.2.0

  Status: Validated by HAK team, v4-compatible release


- [HAK SaucerSwap Plugin](https://www.npmjs.com/package/hak-saucerswap-plugin) provides a streamlined interface to the [**SaucerSwap**](https://saucerswap.finance) DEX, exposing the core actions (`saucerswap_get_swap_quote`, `saucerswap_swap_tokens`, `saucerswap_get_pools`, `saucerswap_add_liquidity`, `saucerswap_remove_liquidity`, `saucerswap_get_farms`) for swaps, liquidity, and farming insights:

  NPM: https://www.npmjs.com/package/hak-saucerswap-plugin

  Github repository: https://github.com/jmgomezl/hak-saucerswap-plugin

  Version: hak-saucerswap-plugin@2.1.0

  Status: Validated by HAK team, v4-compatible release


- [Pyth Plugin](https://www.npmjs.com/package/hak-pyth-plugin) provides access to the [**Pyth Network**](https://www.pyth.network/) price feeds via the Hermes API, exposing tools to list feeds and fetch latest prices:

  NPM: https://www.npmjs.com/package/hak-pyth-plugin

  Github repository: https://github.com/jmgomezl/hak-pyth-plugin

  Version: hak-pyth-plugin@0.2.0

  Status: Validated by HAK team, v4-compatible release


- [HAK Axelar Plugin](https://www.npmjs.com/package/hak-axelar-plugin) enables AI agents to bridge [**Axelar ITS**](https://axelar.network/) tokens and send GMP cross-chain messages between Hedera and 60+ chains (Ethereum, Base, Arbitrum, Polygon, Avalanche, XRPL, and more) via the Axelar Amplifier architecture, exposing tools for chain discovery (`axelar_get_supported_chains`), fee estimation (`axelar_get_message_fee`), GMP messaging (`axelar_send_message`), ITS token bridging (`axelar_send_token`), and delivery tracking (`axelar_get_message_status`):

  NPM: https://www.npmjs.com/package/hak-axelar-plugin

  Github repository: https://github.com/jmgomezl/hak-axelar-plugin

  Version: hak-axelar-plugin@1.0.0

  Status: Not validated by HAK team, v4-compatible release


- [CoinCap Plugin](https://www.npmjs.com/package/coincap-hedera-plugin) provides access to the [**CoinCap API service**](https://www.coincap.io) to access cryptocurrency market data. It exposes the action (`get HBAR price in USD`) to get the current price of HBAR in USD currency, by using it you can ask your agent to get your current HBAR balance expressed in USD.

  NPM: https://www.npmjs.com/package/coincap-hedera-plugin

  Github repository: https://github.com/henrytongv/coincap-hedera-plugin

  Version: coincap-hedera-plugin@1.0.5

  Status: Validated by HAK team, v4-compatible release  


- [Chainlink price feed Plugin](https://www.npmjs.com/package/chainlink-pricefeed-plugin) provides access to the [**Chainlink price feeds**](https://docs.chain.link/data-feeds/price-feeds) to get data aggregated from many data sources. It exposes the action (`get price feed`) that allows you to get the current price for ETH, BTC, HBAR, LINK, USDC, UST or DAI.

  NPM: https://www.npmjs.com/package/chainlink-pricefeed-plugin

  Github repository: https://github.com/henrytongv/chainlink-price-plugin-js

  Version: chainlink-pricefeed-plugin@1.0.5

  Status: Validated by HAK team, v4-compatible release  


- [Hedera T3N Plugin](https://www.npmjs.com/package/@terminal3/hedera-t3n-plugin) provides access to [Terminal 3 Network (T3N)](https://docs.terminal3.io/t3n/) to enable identity verification, authentication, and last mile-delivery or selective disclosure of private and sensitive information for AI-driven applications, ensuring compliant and auditable interactions.

  NPM: https://www.npmjs.com/package/@terminal3/hedera-t3n-plugin

  Github repository: https://github.com/Terminal-3/hedera-t3n-plugin

  Version: @terminal3/hedera-t3n-plugin@3.0.0

  Status: Not validated by HAK team, v3-compatible release

- [MPP Hedera Plugin](https://www.npmjs.com/package/hak-mppx-hedera-plugin) enables AI agents to pay for 402-protected APIs using USDC on Hedera via the [Machine Payments Protocol](https://mpp.dev), exposing tools for one-shot charge payments (`mppx_hedera_charge_fetch_tool`) and streaming session payments (`mppx_hedera_session_open_tool`, `mppx_hedera_session_fetch_tool`, `mppx_hedera_session_close_tool`):

  NPM: https://www.npmjs.com/package/hak-mppx-hedera-plugin

  Github repository: https://github.com/tomrowbo/hak-mppx-hedera-plugin

  Version: hak-mppx-hedera-plugin@1.2.0

  Status: Not validated by HAK team, v4-compatible release

## Plugin Architecture

The tools are now organized into plugins, each containing a set functionality related to the Hedera service or project they are created for.

## Creating a Plugin

> All commits for your plugin must be [DCO signed](https://wiki.linuxfoundation.org/dco). To avoid having pull requests blocked in the future, always include a sign-off.


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

Each tool must implement the `Tool` interface:

```typescript
export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
  // transactionToolOutputParser and untypedQueryOutputParser can be used. If required, define a custom parser
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string };
};
```

See [packages/core/src/shared/tools.ts](../packages/core/src/shared/tools.ts) for the full definition.

### Recommended: Extend `BaseTool` (v4)

> [!IMPORTANT]
> **`BaseTool` is the recommended way to implement tools in v4.** It is an abstract class that **implements** the `Tool` interface, so it is a fully backward-compatible, non-breaking upgrade. Tools based on the older functional pattern (plain object literals) continue to work, but they **do not support hooks and policies**.

`BaseTool` enforces a clean 7-stage lifecycle that lets the hooks and policies system tap in automatically — you never call hooks manually:

```text
[1] preToolExecutionHook        ← hooks/policies
[2] normalizeParams             ← your logic
[3] postParamsNormalizationHook ← hooks/policies
[4] coreAction                  ← your logic (build tx or run query)
[5] postCoreActionHook          ← hooks/policies
[6] secondaryAction             ← your logic (sign/submit tx; skip for queries)
[7] postToolExecutionHook       ← hooks/policies
```

For a step-by-step migration guide with fully annotated before/after code, see
[Migrating Custom Tools to BaseTool](MIGRATION-v4.md#migrating-custom-tools-to-basetool-recommended-non-breaking) in the v4 migration guide.

### Step-by-Step Guide

**Step 1: Create Plugin Directory Structure**

```
  my-custom-plugin/
  ├── index.ts                    # Plugin definition and exports
  ├── tools/
  │   └── my-service/
  │       └── my-tool.ts         # Individual tool implementation
```

**Step 2: Implement Your Tool**

Create your tool file (e.g., tools/my-service/my-tool.ts).

> [!TIP]
> **v4 Recommended approach — extend `BaseTool`.**  
> `BaseTool` implements the `Tool` interface, so this is a **non-breaking change**: your plugin and all framework adapters keep working unchanged. The benefit is that `BaseTool`-based tools automatically participate in the hooks and policies lifecycle.

```typescript
import { z } from "zod";
import { Context, BaseTool } from "@hashgraph/hedera-agent-kit";
import { Client } from "@hiero-ledger/sdk";

// Define your parameter schema (same as before)
const myToolParameters = z.object({
  requiredParam: z.string().describe("Description of required parameter"),
  optionalParam: z
    .string()
    .optional()
    .describe("Description of optional parameter"),
});

export const MY_TOOL = "my_tool";

// Extend BaseTool — BaseTool implements Tool, so this is backward-compatible
export class MyTool extends BaseTool {
  method = MY_TOOL;
  name = "My Custom Tool";
  description = `
  This tool performs a specific operation.

  Parameters:
  - requiredParam (string, required): Description
  - optionalParam (string, optional): Description
  `;
  parameters = myToolParameters;

  // Stage 1 - Here preToolExecutionHook() will be called automatically - see the 7-stage lifecycle above.

  // Stage 2 — validate / transform raw params from the LLM
  async normalizeParams(
    params: z.infer<typeof myToolParameters>,
    _context: Context,
    _client: Client,
  ) {
    return params; // pass-through; add validation/transformation here
  }

  // Stage 3 - Here postParamsNormalizationHook() will be called automatically.

  // Stage 4 — core business logic (build a transaction or run a query)
  async coreAction(
    normalisedParams: z.infer<typeof myToolParameters>,
    _context: Context,
    _client: Client,
  ) {
    // Your implementation here
    return `Result for ${normalisedParams.requiredParam}`;
  }

  // Stage 5 - Here postCoreActionHook() will be called automatically.

  // Skip secondary action for non-transaction tools
  async shouldSecondaryAction(_result: any, _context: Context) {
    return false; // return true (default) if you need to sign/submit a transaction
  }

  // Stage 6 — sign/submit the transaction (omit for query-only tools)
  async secondaryAction(result: any, _client: Client, _context: Context) {
    return result; // no-op for non-transaction tools
  }

  // Stage 7 - Here postToolExecutionHook() will be called automatically.
}

// Factory function: return a BaseTool instance (satisfies the Tool interface)
const tool = (_context: Context) => new MyTool();

export default tool;
```

> [!NOTE]  
> Stages 1, 3, 5, and 7 must not be defined by the plugin. They are automatically handled by the \`BaseTool\` implementation and the hooks/policies system. Developers only need to implement the core logic stages (2, 4, and 6).


<details>
<summary>Legacy v3 pattern (still works, but no hook/policy support)</summary>

```typescript
import { z } from "zod";
import { Context, Tool } from "@hashgraph/hedera-agent-kit";
import { Client } from "@hashgraph/sdk";

const myToolParameters = (context: Context = {}) =>
  z.object({
    requiredParam: z.string().describe("Description of required parameter"),
    optionalParam: z
      .string()
      .optional()
      .describe("Description of optional parameter"),
  });

const myToolPrompt = (context: Context = {}) => {
  return `
  This tool performs a specific operation.

  Parameters:
  - requiredParam (string, required): Description
  - optionalParam (string, optional): Description
  `;
};

const myToolExecute = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof myToolParameters>>,
) => {
  try {
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

// This pattern works in v4 but does NOT support hooks or policies
const tool = (context: Context): Tool => ({
  method: MY_TOOL,
  name: "My Custom Tool",
  description: myToolPrompt(context),
  parameters: myToolParameters(context),
  execute: myToolExecute,
});

export default tool;
```

</details>

**Step 3: Create Plugin Definition**

Create your plugin index file (index.ts):

```typescript
  import { Context, Plugin } from '@hashgraph/hedera-agent-kit';
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
```
**Step 4: Register Your Plugin**

Add your plugin to the main plugins index (src/plugins/index.ts):

``` typescript
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

- Use `handleTransaction()` to facilitate human-in-the-loop and autonomous execution flows
- Respect the AgentMode (`AUTONOMOUS` vs `RETURN_BYTES`)
- Implement proper transaction building patterns

### Tool Output Parsing

The Hedera Agent Kit tools return a structured JSON output that needs to be parsed to be useful for the agent and the user.

**LangChain v0.3 (Classic)**
In the classic approach, the agent handles the tool output automatically, but you may need to parse it if you are handling tool calls manually.

**LangChain v1 (New)**
In LangChain v1, we use the `ResponseParserService` to handle tool outputs. This service normalizes the output from both transaction and query tools into a consistent format:

```typescript
{
  raw: any;          // The raw data returned by the tool (e.g., transaction receipt, query result)
  humanMessage: string; // A human-readable message describing the result
}
```

This allows you to easily display a user-friendly message while still having access to the raw data for further processing.

### Using Your Custom Plugin

#### LangChain v0.3 (Classic)

```typescript
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
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

#### LangChain v1 (New)

```typescript
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaLangchainToolkit, ResponseParserService } from "@hashgraph/hedera-agent-kit-langchain";
import {
  myCustomPlugin,
  myCustomPluginToolNames,
} from "./plugins/my-custom-plugin";

// Initialize toolkit
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

// Initialize response parser
const responseParsingService = new ResponseParserService(toolkit.getTools());

// ... inside your agent loop ...
const response = await agent.invoke({ messages: [/* ... */] });

// Parse tool outputs
const parsedToolData = responseParsingService.parseNewToolMessages(response);
const toolCall = parsedToolData[0]; // assuming only one tool was called

if (toolCall) {
  console.log('Human Message:', toolCall.parsedData.humanMessage);
  console.log('Raw Data:', toolCall.parsedData.raw);
}
```

### Examples and References

- See the annotated example plugin in [examples/plugin/example-plugin.ts](../examples/plugin/example-plugin.ts)
- See existing core plugins in `packages/core/src/plugins/core-*-plugin/`
- Follow the patterns established in tools like [transfer-hbar.ts](../packages/core/src/plugins/core-account-plugin/tools/account/transfer-hbar.ts)
- See [examples/langchain/tool-calling-agent.ts](../examples/langchain/tool-calling-agent.ts) for usage examples
- For migrating existing v3 tools to `BaseTool`, see the [Migration Guide](MIGRATION-v4.md#migrating-custom-tools-to-basetool-recommended-non-breaking)
## Publish and Register Your Plugin

> All commits for your plugin must be [DCO signed](https://wiki.linuxfoundation.org/dco). To avoid having pull requests blocked in the future, always include a sign-off.



To create a plugin to be used with the Hedera Agent Kit, you will need to create a plugin in your own repository, publish a npm package, and provide a description of the functionality included in that plugin, as well as the required and optional parameters.

Once you have a repository, published npm package, and a README with a description of the functionality included in that plugin in your plugin's repo, as well as the required and optional parameters, you can add it to the Hedera Agent Kit by forking and opening a Pull Request to:

1. Include the plugin as a bullet point under the **Available Third Party Plugin** section _on this page_. Include the name, a brief description, and a link to the repository with the README, as well the URL linked to the published npm package.

2. Include the same information **in the README.md of this repository** under the **Third Party Plugins** section.

3. All commits for your plugin **must be [DCO signed](https://wiki.linuxfoundation.org/dco)**, have the names of the tools & core actions exposed by the plugin, and **point to the exact version of the npm packages**. To avoid having pull requests blocked in the future, always include a sign-off:

```Bonzo Plugin is a unified SDK to the Bonzo protocol, exposing the core actions (deposit, withdraw, repay, borrow) for decentralised lending and borrowing on Hedera:
NPM: https://www.npmjs.com/package/@bonzofinancelabs/hak-bonzo-plugin
Github repository: https://github.com/Bonzo-Labs/bonzoPlugin
Version: @bonzofinancelabs/hak-bonzo-plugin@1.0.1
Status: Not validated by HAK team, v3-compatible release 
```

Feel free to also [reach out to the Hedera Agent Kit maintainers on Discord](https://hedera.com/discord) or another channel so we can test out your plugin, include it in our docs, and let our community know thorough marketing and community channels.

Please also reach out in the Hedera Discord in the Support > developer-help-desk channel create an Issue in this repository for help building, publishing, and promoting your plugin

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

'''typescript
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';

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
