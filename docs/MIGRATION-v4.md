# Migrating from v3 to v4

Version 4 of the Hedera Agent Kit replaces the single monolithic `hedera-agent-kit` package with a family of `@hashgraph`-scoped packages. The core package (`@hashgraph/hedera-agent-kit`) now contains only shared APIs, types, and the plugin system. Framework integrations (LangChain, Vercel AI SDK, ElizaOS, MCP) have been extracted into dedicated toolkit packages that bundle their own framework dependencies. Built-in plugins are no longer exported from the package root; they must be imported from the `@hashgraph/hedera-agent-kit/plugins` subpath and explicitly passed in the configuration. Several deprecated aliases (`coreHTSPlugin`, `coreSCSPlugin`, `coreQueriesPlugin`) have been removed. This guide documents all breaking changes, provides before/after migration examples for each supported framework, and includes a checklist for documentation maintainers updating [docs.hedera.com](https://docs.hedera.com).

## Breaking Changes

### 1. Package rename and scope

The package has moved from the unscoped `hedera-agent-kit` to the `@hashgraph` scope:

```diff
- npm install hedera-agent-kit
+ npm install @hashgraph/hedera-agent-kit
```

The old `hedera-agent-kit` package on npm will no longer receive updates.

### 2. Toolkit packages extracted into separate packages

Framework integrations are no longer bundled in the core package. Each toolkit is its own npm package:

| Package | Exports |
|---|---|
| `@hashgraph/hedera-agent-kit` | `HederaAgentAPI`, `AgentMode`, `Configuration`, `Context`, `Plugin`, `Tool`, `ToolDiscovery`, `HederaBuilder`, `handleTransaction`, `ExecuteStrategy`, parameter schemas, mirrornode types |
| `@hashgraph/hedera-agent-kit-langchain` | `HederaLangchainToolkit`, `ResponseParserService`, `HederaMCPServer` |
| `@hashgraph/hedera-agent-kit-ai-sdk` | `HederaAIToolkit`, `HederaMCPServer` |
| `@hashgraph/hedera-agent-kit-elizaos` | `HederaElizaOSToolkit` |
| `@hashgraph/hedera-agent-kit-mcp` | `HederaMCPToolkit` |

### 3. Plugin imports moved to `/plugins` subpath

Plugins are **no longer exported from the root** of the core package. They must be imported from the `/plugins` subpath:

```diff
- import { coreTokenPlugin, coreAccountPlugin } from 'hedera-agent-kit';
+ import { coreTokenPlugin, coreAccountPlugin } from '@hashgraph/hedera-agent-kit/plugins';
```

All built-in plugins are available from this single subpath:

```typescript
import {
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
```

### 4. Explicit plugin opt-in (behavioral change)

In v3, the toolkit may have loaded default tools even with an empty `plugins` array. In v4, **empty `plugins` means zero tools**. You must explicitly pass every plugin you need.

This is a **silent behavioral change**. The code will not throw an error, but your agent will have no tools available.

```typescript
// v4: you MUST pass plugins explicitly
const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [coreAccountPlugin, coreTokenPlugin], // required, empty array = no tools
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

If you want the v3 "everything" behaviour, use the `allCorePlugins` shortcut from the `/plugins` subpath:

```typescript
import { allCorePlugins } from '@hashgraph/hedera-agent-kit/plugins';

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: allCorePlugins,
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

`allCorePlugins` is the array of every built-in core plugin (account, token, consensus, EVM, plus all query plugins). Pick individual plugins instead when you want a smaller tool surface; bundlers will tree-shake the unused ones either way.

### 5. Deprecated aliases removed

The following deprecated plugin aliases have been removed. Update your imports:

| Removed alias | Replacement |
|---|---|
| `coreHTSPlugin` | `coreTokenPlugin` |
| `coreSCSPlugin` | `coreEVMPlugin` |
| `coreQueriesPlugin` | Use individual query plugins: `coreAccountQueryPlugin`, `coreTokenQueryPlugin`, `coreConsensusQueryPlugin`, `coreEVMQueryPlugin`, `coreMiscQueriesPlugin`, `coreTransactionQueryPlugin` |

### 6. Framework dependencies are now transitive

In v3, you had to install framework dependencies alongside the agent kit:

```bash
# v3: all of these were required
npm install hedera-agent-kit @langchain/core langchain @langchain/langgraph @langchain/openai @hashgraph/sdk
```

In v4, framework dependencies are bundled inside the toolkit packages:

- **`@hashgraph/hedera-agent-kit-langchain`** bundles `@langchain/core`, `langchain`, `@langchain/mcp-adapters`
- **`@hashgraph/hedera-agent-kit-ai-sdk`** bundles `ai`, `@ai-sdk/mcp`

You always need to install your LLM provider separately. The toolkit does not pick one for you:

```bash
# v4 LangChain + OpenAI
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai

# v4 LangChain + Anthropic
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/anthropic

# v4 AI SDK + OpenAI
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai
```

### 7. MCP configuration moved to toolkit packages

`HederaMCPServer` enum and MCP-related configuration are no longer exported from core. They are now in the respective toolkit packages:

```diff
- import { HederaMCPServer } from 'hedera-agent-kit';
+ import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';
// or
+ import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-ai-sdk';
```

### 8. Hedera SDK renamed to `@hiero-ledger/sdk` and moved to peer dependency

The Hedera SDK has been renamed from `@hashgraph/sdk` to `@hiero-ledger/sdk`. In v3, the SDK was a regular dependency of the agent kit and installed automatically. In v4, all packages declare `@hiero-ledger/sdk` as a **peer dependency** (`^2.81.0`) - you must install it yourself:

```diff
- npm install @hashgraph/sdk
+ npm install @hiero-ledger/sdk
```

Update every import that previously pulled from `@hashgraph/sdk`:

```diff
- import { Client, PrivateKey } from '@hashgraph/sdk';
+ import { Client, PrivateKey } from '@hiero-ledger/sdk';
```

`@hiero-ledger/sdk` is the successor package maintained under the Hiero Ledger project; the `@hashgraph/sdk` package on npm is no longer receiving updates aligned with the agent kit.

### 9. `RETURN_BYTES` mode - `raw.bytes` standardized to `Uint8Array`

In v3, `raw.bytes` returned by `ResponseParserService` could be a Node.js `Buffer` or a `{ type: 'Buffer', data: [...] }` plain object, depending on the environment. In v4, `raw.bytes` is always a `Uint8Array` in both Node.js and browser environments.

**Before (v3):**
```
const realBytes = parseTransactionBytes(toolCall.parsedData.raw.bytes);
const realBytes = Buffer.isBuffer(bytesObject)
? bytesObject
: Buffer.from(bytesObject.data);
const tx = Transaction.fromBytes(realBytes);
```
**After (v4):**
```
const bytes = toolCall.parsedData.raw.bytes;
const tx = Transaction.fromBytes(bytes);
```

If you have custom code that converts the bytes payload before passing it to `Transaction.fromBytes`, remove that conversion - `raw.bytes` is now a plain `Uint8Array` and can be passed directly.


## Installation Changes

### LangChain

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk @langchain/core langchain @langchain/langgraph @langchain/openai dotenv
```

**After (v4):** `@langchain/core` and `langchain` are bundled in the toolkit. Install your LLM provider separately.
```bash
# OpenAI
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai dotenv

# Anthropic
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/anthropic dotenv

# Groq
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/groq dotenv

# Ollama (local, no API key needed)
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/ollama dotenv
```

### Vercel AI SDK

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk ai @ai-sdk/openai dotenv
```

**After (v4):** `ai` is bundled in the toolkit. LLM provider is **not** bundled, always install it.
```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai dotenv
```

### ElizaOS

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk
```

**After (v4):**
```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-elizaos
```

### MCP

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk
```

**After (v4):**
```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-mcp
```

## Framework-Specific Migration

### LangChain

**Before (v3):**

```bash
npm install hedera-agent-kit @hashgraph/sdk @langchain/core langchain @langchain/langgraph @langchain/openai dotenv
```

```javascript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY)
);

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const tools = toolkit.getTools();
```

**After (v4):**

```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai dotenv
# Always install your LLM provider explicitly: @langchain/openai, @langchain/anthropic, @langchain/groq, or @langchain/ollama
```

```typescript
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { allCorePlugins } from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
);

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: allCorePlugins, // or pick individual plugins for a smaller tool surface
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const agent = createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o-mini' }),
  tools: toolkit.getTools(),
  systemPrompt: 'You are a helpful assistant with access to Hedera blockchain tools',
});

const response = await agent.invoke({
  messages: [{ role: 'user', content: "What's my HBAR balance?" }],
});
```

**Key changes:**
- `HederaLangchainToolkit` now comes from `@hashgraph/hedera-agent-kit-langchain`
- `AgentMode` comes from `@hashgraph/hedera-agent-kit`
- Plugins come from `@hashgraph/hedera-agent-kit/plugins` and must be explicitly passed
- `@langchain/core` and `langchain` no longer need separate install (LLM provider like `@langchain/openai` still does)

**ResponseParserService** has also moved:

```diff
- import { ResponseParserService } from 'hedera-agent-kit';
+ import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
```

### Vercel AI SDK

**Before (v3):**

```bash
npm install hedera-agent-kit @hashgraph/sdk ai @ai-sdk/openai dotenv
```

```javascript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaAIToolkit, AgentMode, coreTokenPlugin, coreAccountPlugin } from 'hedera-agent-kit';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY)
);

const toolkit = new HederaAIToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const response = await generateText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: "What's my balance?" }],
  tools: toolkit.getTools(),
});
```

**After (v4):**

```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai dotenv
# `ai` is bundled in the toolkit
# LLM provider (@ai-sdk/openai, @ai-sdk/anthropic, etc.) is NOT bundled, always install it
```

```typescript
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { allCorePlugins } from '@hashgraph/hedera-agent-kit/plugins';
import { HederaAIToolkit } from '@hashgraph/hedera-agent-kit-ai-sdk';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
);

const toolkit = new HederaAIToolkit({
  client,
  configuration: {
    plugins: allCorePlugins, // or pick individual plugins for a smaller tool surface
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: toolkit.middleware(),
});

const response = await generateText({
  model,
  messages: [{ role: 'user', content: "What's my balance?" }],
  tools: toolkit.getTools(),
  stopWhen: stepCountIs(2),
});
```

**Key changes:**
- `HederaAIToolkit` now comes from `@hashgraph/hedera-agent-kit-ai-sdk`
- `AgentMode` comes from `@hashgraph/hedera-agent-kit`
- Plugins come from `@hashgraph/hedera-agent-kit/plugins` and must be explicitly passed
- `ai` no longer needs separate install; LLM provider (`@ai-sdk/openai`) still does

### ElizaOS

**Before (v3):**

```bash
npm install hedera-agent-kit @hashgraph/sdk
```

```javascript
import { HederaElizaOSToolkit } from 'hedera-agent-kit/elizaos';

const toolkit = new HederaElizaOSToolkit({
  client,
  configuration: {
    plugins: [],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

**After (v4):**

```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-elizaos
```

```typescript
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { coreTokenPlugin, coreAccountPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import { HederaElizaOSToolkit } from '@hashgraph/hedera-agent-kit-elizaos';

const toolkit = new HederaElizaOSToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

**Key changes:**
- The `hedera-agent-kit/elizaos` subpath no longer exists
- ElizaOS is now its own package: `@hashgraph/hedera-agent-kit-elizaos`

### MCP

**Before (v3):**

```bash
npm install hedera-agent-kit @hashgraph/sdk
```

```typescript
import { HederaMCPToolkit, AgentMode } from 'hedera-agent-kit';

const server = new HederaMCPToolkit({
  client,
  configuration: {
    plugins: [],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

**After (v4):**

```bash
npm install @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-mcp
```

```typescript
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { coreTokenPlugin, coreAccountPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';

const server = new HederaMCPToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});
```

**Key changes:**
- `HederaMCPToolkit` now comes from `@hashgraph/hedera-agent-kit-mcp`
- `AgentMode` comes from `@hashgraph/hedera-agent-kit`
- Plugins come from `@hashgraph/hedera-agent-kit/plugins` and must be explicitly passed

### Preconfigured MCP Client

The `HederaMCPServer` enum configures connections to external MCP servers (Hederion, Hgraph). It moved from core to the toolkit packages.

**Before (v3):**

```javascript
import { HederaMCPServer } from 'hedera-agent-kit';
```

**After (v4):**

```typescript
// When using LangChain toolkit:
import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';

// When using AI SDK toolkit:
import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-ai-sdk';
```

> **Note:** `HederaMCPServer` is for connecting to **external** MCP servers as a client. It is separate from `@hashgraph/hedera-agent-kit-mcp`, which exports the `HederaMCPToolkit` adapter.

## Plugin Author Migration

If you maintain a third-party plugin for the Hedera Agent Kit, update the following:

**1. Update your imports:**

```diff
- import { Context, Tool, handleTransaction, Plugin } from 'hedera-agent-kit';
+ import { Context, Tool, handleTransaction, Plugin } from '@hashgraph/hedera-agent-kit';
```

The `Plugin`, `Tool`, `Context`, and `handleTransaction` types/utilities are still exported from the core package. The interface has not changed.

**2. Update your `package.json` peer dependency:**

```diff
  "peerDependencies": {
-   "hedera-agent-kit": "^3.0.0"
+   "@hashgraph/hedera-agent-kit": "^4.0.0"
  }
```

**3. Update your README examples** to show the new import patterns with `@hashgraph/hedera-agent-kit/plugins` for built-in plugins.

**4. (Recommended) Migrate your tools to `BaseTool`** to gain support for the hooks and policies system introduced in v4. See the [Migrating Custom Tools to BaseTool](#migrating-custom-tools-to-basetool-recommended-non-breaking) section below.

---

## Migrating Custom Tools to BaseTool (Recommended, Non-Breaking)

> [!IMPORTANT]
> **This is NOT a breaking change.** Tools that directly implement the `Tool` interface continue to work exactly as before in v4. However, they will **not** benefit from the hooks and policies system (e.g., `HcsAuditTrailHook`, `MaxRecipientsPolicy`, `RejectToolPolicy`) introduced in v4. To enable those features, migrate your tool to the `BaseTool` abstract class, which itself implements the `Tool` interface.

### Why migrate?

- Unlock **hooks** (logging, audit trails, metrics) and **policies** (blocking rules, rate limits)
- Enforce a consistent, structured tool lifecycle across your plugin
- Benefit from built-in error handling and hook dispatching

### What is `BaseTool`?

`BaseTool` is an abstract class that **implements** the `Tool` interface. This means any class extending `BaseTool` is a drop-in replacement everywhere a `Tool` is expected — including inside `Plugin.tools()`. The class enforces a 7-stage lifecycle:

```text
[1] preToolExecutionHook
[2] normalizeParams        ← your logic
[3] postParamsNormalizationHook
[4] coreAction             ← your logic
[5] postCoreActionHook
[6] secondaryAction        ← your logic (optional, e.g. tx signing)
[7] postToolExecutionHook
```

Hooks and policies tap into stages 1, 3, 5, and 7 automatically — **you never call them manually**.

### Step-by-step migration

Below is a fully annotated before/after comparison using the `transfer_hbar` tool as the reference example.

#### Before (v3 — functional `Tool` object)

```typescript
import { z } from 'zod';
import type { Context } from '@/shared/configuration';
// ── The old approach returned a plain Tool object literal ──
import type { Tool } from '@/shared/tools';
import { Client, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

// ── Tool description / prompt ──────────────────────────────────────────────
const transferHbarPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId', context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  return `
${contextSnippet}
This tool will transfer HBAR to an account.
Parameters:
- transfers (array): List of transfers. Each: { accountId, amount }
- ${sourceAccountDesc}
- transactionMemo (string, optional)
${PromptGenerator.getScheduledTransactionParamsDescription(context)}
${usageInstructions}
`;
};

// ── Post-processing helper ─────────────────────────────────────────────────
const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled HBAR transfer created successfully.\nTransaction ID: ${response.transactionId}\nSchedule ID: ${response.scheduleId.toString()}`;
  }
  return `HBAR successfully transferred.\nTransaction ID: ${response.transactionId}`;
};

// ── Standalone execute function — ALL logic lives here ─────────────────────
// This monolithic function cannot be split into hookable lifecycle stages,
// so hooks and policies have no entry points.
const transferHbar = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transferHbarParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseTransferHbar(
      params, context, client,
    );
    const tx = HederaBuilder.transferHbar(normalisedParams);
    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to transfer HBAR';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
};

export const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';

// ── Factory function returns a plain Tool object literal ───────────────────
// ✗ No hook/policy support — execute() is opaque to the framework
const tool = (context: Context): Tool => ({
  method: TRANSFER_HBAR_TOOL,
  name: 'Transfer HBAR',
  description: transferHbarPrompt(context),
  parameters: transferHbarParameters(context),
  execute: transferHbar,
  outputParser: transactionToolOutputParser,
});

export default tool;
```

#### After (v4 — `BaseTool` class)

```typescript
import { z } from 'zod';
import type { Context } from '@/shared/configuration';
// ── Import BaseTool instead of the raw Tool type ───────────────────────────
// BaseTool implements Tool, so this remains fully backward-compatible.
import { BaseTool } from '@/shared/tools';
import { Client, Status } from '@hiero-ledger/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { transferHbarParameters } from '@/shared/parameter-schemas/account.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

// ── Tool description / prompt (unchanged from v3) ──────────────────────────
const transferHbarPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId', context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();
  return `
${contextSnippet}
This tool will transfer HBAR to an account.
Parameters:
- transfers (array): RECIPIENTS ONLY. Do NOT include the sender here.
  Each: { accountId (recipient), amount }
- ${sourceAccountDesc} (this is the sender; do NOT put it in transfers)
- transactionMemo (string, optional)
${PromptGenerator.getScheduledTransactionParamsDescription(context)}
${usageInstructions}
`;
};

// ── Post-processing helper (unchanged from v3) ─────────────────────────────
const postProcess = (response: RawTransactionResponse) => {
  if (response.scheduleId) {
    return `Scheduled HBAR transfer created successfully.\nTransaction ID: ${response.transactionId}\nSchedule ID: ${response.scheduleId.toString()}`;
  }
  return `HBAR successfully transferred.\nTransaction ID: ${response.transactionId}`;
};

export const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';

// ── Extend BaseTool instead of returning an object literal ─────────────────
// BaseTool<TParams, TNormalisedParams> — generics are optional but help with types.
export class TransferHbarTool extends BaseTool {
  // ── Required fields from the Tool interface ──────────────────────────────
  method = TRANSFER_HBAR_TOOL;
  name = 'Transfer HBAR';
  description: string;                                  // set in constructor
  parameters: ReturnType<typeof transferHbarParameters>; // set in constructor
  outputParser = transactionToolOutputParser;           // ✓ optional, same as before

  constructor(context: Context) {
    super();
    // Context-dependent fields are computed once at construction time,
    // exactly as the old factory function did.
    this.description = transferHbarPrompt(context);
    this.parameters = transferHbarParameters(context);
  }

  // ── Stage 2: Parameter normalisation ─────────────────────────────────────
  // Called by BaseTool.execute() between preToolExecutionHook and
  // postParamsNormalizationHook. Return the normalised params object.
  async normalizeParams(
    params: z.infer<ReturnType<typeof transferHbarParameters>>,
    context: Context,
    client: Client,
  ) {
    return await HederaParameterNormaliser.normaliseTransferHbar(params, context, client);
  }

  // ── Stage 4: Core action ──────────────────────────────────────────────────
  // Build the transaction (or perform the query). Do NOT sign/submit here.
  // BaseTool will call postCoreActionHook after this returns.
  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.transferHbar(normalisedParams);
  }

  // ── Stage 6: Secondary action ─────────────────────────────────────────────
  // Sign and submit the transaction (or any post-core step).
  // BaseTool.shouldSecondaryAction() returns true by default; override it
  // in query-only tools to skip this stage entirely.
  async secondaryAction(transaction: any, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context, postProcess);
  }

  // ── Error handling ────────────────────────────────────────────────────────
  // Override BaseTool.handleError() for tool-specific error messages.
  // If you omit this, BaseTool provides a sensible default.
  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to transfer HBAR';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[transfer_hbar_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

// ── Factory function: now returns a BaseTool instance ─────────────────────
// Return type changed from Tool → BaseTool, but BaseTool implements Tool,
// so Plugin.tools() and all framework adapters accept this transparently.
const tool = (context: Context): BaseTool => new TransferHbarTool(context);

export default tool;
```

### What changed – summary

| Aspect | v3 (`Tool` object) | v4 (`BaseTool` class) |
|---|---|---|
| Declaration | Object literal `{ method, name, … execute }` | Class extending `BaseTool` |
| Import | `import type { Tool }` | `import { BaseTool }` |
| Lifecycle stages | All inside a single `execute()` function | Split into `normalizeParams`, `coreAction`, `secondaryAction` |
| Hook/Policy support | ✗ None | ✓ Automatic at stages 1, 3, 5, 7 |
| Error handling | Manual `try/catch` inside `execute` | Override `handleError()` (BaseTool provides a default) |
| Breaking change? | — | **No** — `BaseTool implements Tool` |

### Migrating a query-only tool

For tools that only read data (no transaction signing), override `shouldSecondaryAction` to skip stage 6:

```typescript
export class MyQueryTool extends BaseTool {
  // ...

  // Stage 4: perform the query and return the result directly
  async coreAction(normalisedParams: any, _context: Context, client: Client) {
    return await someHederaQuery(normalisedParams, client);
  }

  // Skip secondaryAction for query tools — there is nothing to sign/submit
  async shouldSecondaryAction(_coreActionResult: any, _context: Context) {
    return false;
  }

  // secondaryAction is still required by the abstract class — provide a no-op
  async secondaryAction(result: any, _client: Client, _context: Context) {
    return result;
  }
}
```

## Doc Maintainer Checklist

Use this checklist when updating pages on [docs.hedera.com](https://docs.hedera.com) for v4 compatibility.

### Global find-and-replace

- [ ] Replace all `from 'hedera-agent-kit'` and `from "hedera-agent-kit"` with the appropriate `@hashgraph/hedera-agent-kit*` import (see import table above)
- [ ] Replace all `from '@hashgraph/sdk'` with `from '@hiero-ledger/sdk'` (SDK rename - see [Breaking Change #8](#8-hedera-sdk-renamed-to-hiero-ledgersdk-and-moved-to-peer-dependency))
- [ ] Replace `npm install @hashgraph/sdk` with `npm install @hiero-ledger/sdk`
- [ ] Replace `npm install hedera-agent-kit` with the framework-specific install commands
- [ ] Replace `coreHTSPlugin` with `coreTokenPlugin`
- [ ] Replace `coreSCSPlugin` with `coreEVMPlugin`
- [ ] Replace `coreQueriesPlugin` with the individual query plugins
- [ ] Replace `hedera-agent-kit/elizaos` subpath imports with `@hashgraph/hedera-agent-kit-elizaos`

### Pages that need updates

- [ ] **Quick Start / Getting Started**: Update install command, imports, and "Hello World" code example
- [ ] **Plugins page**: Update plugin imports to use `/plugins` subpath; remove deprecated alias references
- [ ] **LangChain integration**: Split imports between `@hashgraph/hedera-agent-kit` and `@hashgraph/hedera-agent-kit-langchain`; update `ResponseParserService` import
- [ ] **AI SDK integration**: Update to `@hashgraph/hedera-agent-kit-ai-sdk`
- [ ] **ElizaOS integration**: Update to `@hashgraph/hedera-agent-kit-elizaos`; remove v3.5 subpath migration note
- [ ] **MCP integration**: Update to `@hashgraph/hedera-agent-kit-mcp`; update `HederaMCPToolkit` import
- [ ] **Plugin authoring guide**: Update template imports; update peer dependency guidance
- [ ] **npm package links**: Update from `npmjs.com/package/hedera-agent-kit` to `npmjs.com/package/@hashgraph/hedera-agent-kit`

### Content to add

- [ ] Migration banner on quickstart page linking to this guide
- [ ] "Which package do I need?" table (core + one toolkit)
- [ ] Explicit plugin opt-in documentation (empty `plugins` = no tools; use `allCorePlugins` for the v3-style "everything" default)
- [ ] Note explaining that new hooks and policies are only supported by tools extending `BaseTool`
- [ ] Recommendation and guide for migrating custom tools to `BaseTool`

### Content to remove

- [ ] v3.5.0 ElizaOS migration note (the `/elizaos` subpath no longer exists)
- [ ] References to deprecated plugin aliases (`coreHTSPlugin`, `coreSCSPlugin`, `coreQueriesPlugin`)
- [ ] Instructions to manually install `@langchain/core`, `langchain`, `@langchain/langgraph` as direct dependencies (only `@langchain/core` and `langchain` are now transitive; LLM providers still need explicit install)

## Quick-Reference Cheat Sheet

### Package mapping

```
hedera-agent-kit                  → @hashgraph/hedera-agent-kit           (core only)
(bundled)                         → @hashgraph/hedera-agent-kit-langchain (LangChain)
(bundled)                         → @hashgraph/hedera-agent-kit-ai-sdk    (Vercel AI SDK)
hedera-agent-kit/elizaos          → @hashgraph/hedera-agent-kit-elizaos   (ElizaOS)
(bundled)                         → @hashgraph/hedera-agent-kit-mcp       (MCP)
```

### Import mapping

**Toolkits** (each moved to its own package):
```diff
- import { HederaLangchainToolkit } from 'hedera-agent-kit'
+ import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain'

- import { HederaAIToolkit } from 'hedera-agent-kit'
+ import { HederaAIToolkit } from '@hashgraph/hedera-agent-kit-ai-sdk'

- import { HederaElizaOSToolkit } from 'hedera-agent-kit/elizaos'
+ import { HederaElizaOSToolkit } from '@hashgraph/hedera-agent-kit-elizaos'

- import { HederaMCPToolkit } from 'hedera-agent-kit'
+ import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp'
```

**Core types** (same exports, new package name):
```diff
- import { AgentMode, Configuration, Context, Plugin, Tool } from 'hedera-agent-kit'
+ import { AgentMode, Configuration, Context, Plugin, Tool } from '@hashgraph/hedera-agent-kit'

- import { handleTransaction } from 'hedera-agent-kit'
+ import { handleTransaction } from '@hashgraph/hedera-agent-kit'
```

**Plugins** (moved from root to `/plugins` subpath):
```diff
- import { coreTokenPlugin, coreAccountPlugin, ... } from 'hedera-agent-kit'
+ import { coreTokenPlugin, coreAccountPlugin, ... } from '@hashgraph/hedera-agent-kit/plugins'
```

**Toolkit-specific exports** (moved to their respective toolkit package):
```diff
- import { ResponseParserService } from 'hedera-agent-kit'
+ import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain'

- import { HederaMCPServer } from 'hedera-agent-kit'
+ import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain'
  // or '@hashgraph/hedera-agent-kit-ai-sdk'
```

**Deprecated aliases** (removed, use replacements):
```diff
- import { coreHTSPlugin } from 'hedera-agent-kit'
+ import { coreTokenPlugin } from '@hashgraph/hedera-agent-kit/plugins'

- import { coreSCSPlugin } from 'hedera-agent-kit'
+ import { coreEVMPlugin } from '@hashgraph/hedera-agent-kit/plugins'

- import { coreQueriesPlugin } from 'hedera-agent-kit'
+ import {
+   coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
+   coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
+ } from '@hashgraph/hedera-agent-kit/plugins'
```

## FAQ / Troubleshooting

**"My agent has no tools / does nothing."**
In v4, you must explicitly pass plugins. An empty `plugins` array means zero tools. Pass `allCorePlugins` from `@hashgraph/hedera-agent-kit/plugins` to restore the v3 "everything" behaviour, or list individual plugins. See [Breaking Change #4](#4-explicit-plugin-opt-in-behavioral-change).

**"Cannot find module 'hedera-agent-kit'."**
The package has been renamed. Install `@hashgraph/hedera-agent-kit` instead.

**"Cannot find module '@hashgraph/hedera-agent-kit/plugins'."**
Make sure you have `@hashgraph/hedera-agent-kit@4.x` installed. The `/plugins` subpath was added in v4.

**"coreHTSPlugin is not exported."**
This alias was removed in v4. Use `coreTokenPlugin` from `@hashgraph/hedera-agent-kit/plugins` instead.

**"coreQueriesPlugin is not exported."**
This monolithic plugin was removed. Use the individual query plugins: `coreAccountQueryPlugin`, `coreTokenQueryPlugin`, `coreConsensusQueryPlugin`, `coreEVMQueryPlugin`, `coreMiscQueriesPlugin`, `coreTransactionQueryPlugin`.

**"ResponseParserService is not exported from @hashgraph/hedera-agent-kit."**
It moved to `@hashgraph/hedera-agent-kit-langchain`.

**"My hooks / policies don't work with my custom plugin tools."**
Hooks and policies only fire for tools that extend the `BaseTool` abstract class. Tools that implement the `Tool` interface directly (the v3 functional pattern) are fully supported but bypass the hook/policy lifecycle entirely — this is intentional and **not a breaking change**. To gain hook and policy support, migrate your tools to `BaseTool`. The migration is straightforward and non-breaking: `BaseTool` itself implements `Tool`, so no call sites need to change. See the [Migrating Custom Tools to BaseTool](#migrating-custom-tools-to-basetool-recommended-non-breaking) section for a step-by-step guide and annotated before/after example.

## Versioning

All packages in the `@hashgraph/hedera-agent-kit` family use **independent versioning with aligned major versions**:

- Minor and patch versions may differ between packages
- Packages on the same major version are intended to work together

Example of a valid combination:

- `@hashgraph/hedera-agent-kit@4.2.0`
- `@hashgraph/hedera-agent-kit-langchain@4.5.1`
- `@hashgraph/hedera-agent-kit-ai-sdk@4.1.3`
