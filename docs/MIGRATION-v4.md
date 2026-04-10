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
| `@hashgraph/hedera-agent-kit-mcp` | `HederaMCPToolkit`, `hedera-agent-kit-mcp` CLI binary |

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
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai

# v4 LangChain + Anthropic
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/anthropic

# v4 AI SDK + OpenAI
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai
```

### 7. MCP configuration moved to toolkit packages

`HederaMCPServer` enum and MCP-related configuration are no longer exported from core. They are now in the respective toolkit packages:

```diff
- import { HederaMCPServer } from 'hedera-agent-kit';
+ import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';
// or
+ import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-ai-sdk';
```

### 8. New MCP CLI binary

The `@hashgraph/hedera-agent-kit-mcp` package provides a standalone CLI:

```bash
npx @hashgraph/hedera-agent-kit-mcp --ledger-id=testnet
```

### 9. `@hashgraph/sdk` moved from dependency to peer dependency

In v3, `@hashgraph/sdk` was a regular dependency and installed automatically. In v4, all packages declare it as a peer dependency (`>=2.80.0`). You must install it yourself:

```bash
npm install @hashgraph/sdk
```

## Installation Changes

### LangChain

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk @langchain/core langchain @langchain/langgraph @langchain/openai dotenv
```

**After (v4):** `@langchain/core` and `langchain` are bundled in the toolkit. Install your LLM provider separately.
```bash
# OpenAI
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai dotenv

# Anthropic
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/anthropic dotenv

# Groq
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/groq dotenv

# Ollama (local, no API key needed)
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/ollama dotenv
```

### Vercel AI SDK

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk ai @ai-sdk/openai dotenv
```

**After (v4):** `ai` is bundled in the toolkit. LLM provider is **not** bundled, always install it.
```bash
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai dotenv
```

### ElizaOS

**Before (v3):**
```bash
npm install hedera-agent-kit @hashgraph/sdk
```

**After (v4):**
```bash
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-elizaos
```

### MCP Server (standalone)

**Before (v3):** MCP was bundled in the main package and not available as a standalone CLI.

**After (v4):**
```bash
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-mcp
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
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain @langchain/openai dotenv
# @langchain/core and langchain are bundled in the toolkit
# Always install your LLM provider: @langchain/openai, @langchain/anthropic, @langchain/groq, or @langchain/ollama
```

```typescript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
  coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
  coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { ChatOpenAI } from '@langchain/openai';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
);

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [
      coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
      coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
      coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
    ],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const tools = toolkit.getTools();
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
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-ai-sdk @ai-sdk/openai dotenv
# `ai` is bundled in the toolkit
# LLM provider (@ai-sdk/openai, @ai-sdk/anthropic, etc.) is NOT bundled, always install it
```

```typescript
import { Client, PrivateKey } from '@hashgraph/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
  coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
  coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
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
    plugins: [
      coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
      coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
      coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
    ],
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
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-elizaos
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

### MCP Server

**Before (v3):** MCP server was bundled in the main package and not available as a standalone CLI.

**After (v4):**

The MCP server is now a standalone package with its own CLI binary.

```bash
npm install @hashgraph/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-mcp
```

**Run directly:**

```bash
npx @hashgraph/hedera-agent-kit-mcp --ledger-id=testnet
```

**Claude Desktop / IDE configuration:**

```json
{
  "mcpServers": {
    "hedera-mcp-server": {
      "command": "npx",
      "args": ["@hashgraph/hedera-agent-kit-mcp", "--ledger-id=testnet"],
      "env": {
        "HEDERA_OPERATOR_ID": "0.0.xxxxx",
        "HEDERA_OPERATOR_KEY": "302e..."
      }
    }
  }
}
```

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

> **Note:** `HederaMCPServer` is for connecting to **external** MCP servers as a client. It is separate from `@hashgraph/hedera-agent-kit-mcp` which runs your own Hedera MCP server.

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

## Doc Maintainer Checklist

Use this checklist when updating pages on [docs.hedera.com](https://docs.hedera.com) for v4 compatibility.

### Global find-and-replace

- [ ] Replace all `from 'hedera-agent-kit'` and `from "hedera-agent-kit"` with the appropriate `@hashgraph/hedera-agent-kit*` import (see import table above)
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
- [ ] **MCP Server page**: Update to `@hashgraph/hedera-agent-kit-mcp`; document CLI binary
- [ ] **Plugin authoring guide**: Update template imports; update peer dependency guidance
- [ ] **npm package links**: Update from `npmjs.com/package/hedera-agent-kit` to `npmjs.com/package/@hashgraph/hedera-agent-kit`

### Content to add

- [ ] Migration banner on quickstart page linking to this guide
- [ ] "Which package do I need?" table (core + one toolkit)
- [ ] Explicit plugin opt-in documentation (empty `plugins` = no tools)
- [ ] MCP CLI binary usage (`npx @hashgraph/hedera-agent-kit-mcp`)

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
(bundled)                         → @hashgraph/hedera-agent-kit-mcp       (MCP server + CLI)
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
In v4, you must explicitly pass plugins. An empty `plugins` array means zero tools. See [Breaking Change #4](#4-explicit-plugin-opt-in-behavioral-change).

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

## Versioning

All packages in the `@hashgraph/hedera-agent-kit` family use **independent versioning with aligned major versions**:

- Minor and patch versions may differ between packages
- Packages on the same major version are intended to work together

Example of a valid combination:

- `@hashgraph/hedera-agent-kit@4.2.0`
- `@hashgraph/hedera-agent-kit-langchain@4.5.1`
- `@hashgraph/hedera-agent-kit-ai-sdk@4.1.3`
