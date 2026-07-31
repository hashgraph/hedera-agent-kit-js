# Example Plugin

An example plugin for the [Hedera Agent Kit](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit) demonstrating the v4 `BaseTool` pattern. Use it as a template when building and publishing your own plugin.

## Tools

| Tool method                  | Class                     | Type        | Description                                                                           |
|------------------------------|---------------------------|-------------|---------------------------------------------------------------------------------------|
| `example_greeting_tool`      | `ExampleGreetingTool`     | Query       | Generates a personalised greeting in English, Spanish, or French. No on-chain action. |
| `example_hbar_transfer_tool` | `ExampleHbarTransferTool` | Transaction | Transfers HBAR to account `0.0.800`. Supports `AUTONOMOUS` and `RETURN_BYTES` modes.  |

## Installation

```bash
npm install @hashgraph/hedera-agent-kit @hiero-ledger/sdk
# or
pnpm add @hashgraph/hedera-agent-kit @hiero-ledger/sdk
```

When publishing your own plugin as an npm package, declare both as peer dependencies:

```json
{
  "peerDependencies": {
    "@hashgraph/hedera-agent-kit": ">=5.0.0",
    "@hiero-ledger/sdk": ">=2.0.0"
  }
}
```

## Usage

### Register the plugin

```typescript
import { HederaAgentKit, AgentMode } from '@hashgraph/hedera-agent-kit';
import { Client } from '@hiero-ledger/sdk';
import examplePlugin from '@your-org/example-plugin'; // or './index'

const client = Client.forTestnet().setOperator(accountId, privateKey);

const kit = new HederaAgentKit(client, {
  mode: AgentMode.AUTONOMOUS,
  plugins: [examplePlugin],
});
```

### Import individual factories and tool-name constants

```typescript
import {
  examplePlugin,
  exampleGreetingTool,
  exampleHbarTransferTool,
  EXAMPLE_GREETING_TOOL,
  EXAMPLE_HBAR_TRANSFER_TOOL,
  examplePluginToolNames,
} from '@your-org/example-plugin';

// Use constants to reference tools without magic strings
console.log(EXAMPLE_GREETING_TOOL);       // 'example_greeting_tool'
console.log(examplePluginToolNames);
// { EXAMPLE_GREETING_TOOL: 'example_greeting_tool', EXAMPLE_HBAR_TRANSFER_TOOL: 'example_hbar_transfer_tool' }
```

## Plugin structure

```
examples/plugin/
├── index.ts                                   # Plugin definition + re-exports
├── tools/
│   ├── greeting/
│   │   └── example-greeting-tool.ts           # Query tool (no transaction)
│   └── hbar/
│       └── example-hbar-transfer-tool.ts      # Transaction tool
├── smoke-test.ts                              # Runnable test (no LLM, no funds)
└── README.md
```

Each tool file exports:

- A `string` constant for the tool method name (e.g. `EXAMPLE_GREETING_TOOL`)
- A named class extending `BaseTool` (e.g. `ExampleGreetingTool`)
- A **default factory function** `(context: Context) => BaseTool`

`index.ts` re-exports everything and defines the `examplePlugin` object (default export).

## Tool patterns

### Query tool (no transaction)

```typescript
import { BaseTool, untypedQueryOutputParser } from '@hashgraph/hedera-agent-kit';

export const MY_QUERY_TOOL = 'my_query_tool';

export class MyQueryTool extends BaseTool {
  method = MY_QUERY_TOOL;
  outputParser = untypedQueryOutputParser; // required for framework adapters

  async coreAction(params, _context, _client) {
    const result = `Result for ${params.requiredParam}`;
    return { raw: { result }, humanMessage: result };
  }

  async shouldSecondaryAction() { return false; }  // skip stage 6
}

const tool = (_context) => new MyQueryTool();
export default tool;
```

### Transaction tool

```typescript
import { BaseTransactionTool, handleTransaction, transactionToolOutputParser } from '@hashgraph/hedera-agent-kit';

export const MY_TX_TOOL = 'my_tx_tool';

const postProcess = (response) => `Operation completed. Transaction ID: ${response.transactionId}`;

export class MyTxTool extends BaseTransactionTool {
  method = MY_TX_TOOL;
  outputParser = transactionToolOutputParser; // required for framework adapters

  async coreAction(params, _context, _client) {
    return HederaBuilder.xxx(params); // BUILD only — do not submit here
  }

  async secondaryAction(transaction, client, context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }
}

const tool = (context) => new MyTxTool(context);
export default tool;
```

> [!IMPORTANT]
> Transaction tools must build in `coreAction` and dispatch in `secondaryAction`. Do **not** override `shouldSecondaryAction` — the default `true` keeps both stages active. This split lets hooks and policies inspect the unsigned transaction before submission (stage 5, `postCoreActionHook`).

## Testing without an LLM

Run the smoke test — no operator credentials, no funds, no network access required:

```bash
npx tsx smoke-test.ts
```

The smoke test:
1. Checks the plugin shape and tool count.
2. Calls the greeting tool directly via `tool.execute()`.
3. Dry-runs the HBAR transfer in `RETURN_BYTES` mode — returns frozen bytes without submitting.
4. Verifies that a lifecycle hook fires correctly.

## Publishing as an npm package

1. **`package.json`** — set `"main"`, `"module"`, and `"types"` to point at your built output; list `@hashgraph/hedera-agent-kit` and `@hiero-ledger/sdk` as `peerDependencies`.
2. **TypeScript** — ship `.d.ts` declarations alongside your compiled JS.
3. **Exports** — re-export everything from `index.ts` so consumers can import factories, classes, and string constants individually.
4. **Versioning** — follow semantic versioning; a breaking change to a tool's parameters or method name is a major bump.
5. **README** — document each tool's parameters, output shape, and any `Context` fields your plugin reads.

See [docs/PLUGINS.md](../../docs/PLUGINS.md) for the full plugin authoring guide, including the complete `BaseTool` lifecycle and hook/policy integration.
