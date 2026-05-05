# ADR 005: TypeScript Package Split Monorepo

- **Status:** Accepted
- **Date:** 2026-03-27
- **Updated:** 2026-04-08

## Context

The current TypeScript SDK ships as a single `hedera-agent-kit` package that bundles:

- shared core APIs
- built-in Hedera plugins
- the Node-only `holAuditTrail` hook
- framework integrations for LangChain, AI SDK, ElizaOS, and MCP

This creates three main problems:

1. **Install bloat**: consumers install framework dependencies they do not use
2. **Dependency conflicts**: framework integrations can pull incompatible versions of overlapping dependencies
3. **Unclear runtime boundaries**: Node-only code lives beside browser-safe code

We evaluated three directions:

### Option 1: Fully granular split

Create separate packages for core, every plugin, hooks, and each toolkit.

Pros:

- maximum install-size isolation
- strongest physical separation of concerns

Cons:

- highest maintenance and release overhead
- too many packages for small query plugins
- more contributor and workspace complexity

### Option 2: Core package plus split toolkits plus plugin barrel

Keep core, plugins, and hooks in one package, but split toolkits into separate packages and expose plugins via a tree-shakeable barrel subpath.

Pros:

- good install-size improvement where it matters most
- clear consumer imports for plugins and toolkits
- lower maintenance cost than Option 1

Cons:

- core package still needs explicit export map maintenance
- hook/browser behavior relies on explicit import discipline

### Option 3: Core package plus split toolkits plus browser/node barrel conditions

Keep one main package entry and swap browser vs Node behavior with conditional exports.

Pros:

- stronger browser/node behavior at the package entrypoint
- clear runtime guidance when browser stubs are used

Cons:

- more barrel maintenance
- still encourages a broader root surface than we want
- does not match our decision to keep hooks as explicit Node-only subpaths

### Option Comparison

| Option | Summary | Pros | Cons |
|---|---|---|---|
| 1 | Fully granular split | Maximum isolation | Too many packages, high maintenance |
| 2 | Core + split toolkits + plugin barrel | Best balance of clarity and complexity | Export map upkeep in core |
| 3 | Core + split toolkits + conditional barrels | Better browser/node branching | Broader root surface, more barrel complexity |

## Decision

We choose **Option 2**.

More precisely, we choose an Option 2-style architecture with these project-specific constraints:

- split toolkit packages
- one core package with a `./plugins` barrel subpath for all built-in plugins
- no root-barrel exports for built-in plugins or hooks
- `hol-audit-trail-hook` stays an explicit Node-only subpath

We are not choosing Option 1 because it creates too many tiny packages for this codebase.

We are not choosing Option 3 because we do not want browser/node conditional barrels or a browser stub for `holAuditTrail`.

We will use a pnpm workspace monorepo and split the TypeScript SDK into a small set of published packages under the `@hashgraph` scope.

### Package layout

```text
packages/
├── core/                 -> @hashgraph/hedera-agent-kit
├── langchain/            -> @hashgraph/hedera-agent-kit-langchain
├── ai-sdk/               -> @hashgraph/hedera-agent-kit-ai-sdk
├── elizaos/              -> @hashgraph/hedera-agent-kit-elizaos
├── mcp/                  -> @hashgraph/hedera-agent-kit-mcp
├── create-hedera-agent/  -> create-hedera-agent (scaffold CLI)
├── core-contracts/       -> private (Hardhat ERC20/ERC721 factory contracts)
└── tests/                -> private workspace package (shared test helpers)
```

### Public API shape

`@hashgraph/hedera-agent-kit` root exports only shared/core APIs such as:

- `HederaAgentAPI`
- `AgentMode`
- `Configuration`
- `Context`
- `Plugin`
- `Tool`
- `ToolDiscovery`
- `HederaBuilder`

Built-in plugins and hooks are not exported from the root barrel.

All built-in plugins are available through a single tree-shakeable `./plugins` subpath:

```ts
import { coreAccountPlugin, coreTokenPlugin } from '@hashgraph/hedera-agent-kit/plugins'
```

The `./plugins` barrel re-exports all 10 built-in plugins. Combined with `"sideEffects": false` in package.json, bundlers (webpack, Vite, Rollup, esbuild) tree-shake unused plugins from the final bundle.

Available plugins:

- `coreAccountPlugin` / `coreAccountToolNames`
- `coreTokenPlugin` / `coreTokenToolNames`
- `coreConsensusPlugin` / `coreConsensusToolNames`
- `coreEvmPlugin` / `coreEvmToolNames`
- `coreAccountQueryPlugin` / `coreAccountQueryToolNames`
- `coreTokenQueryPlugin` / `coreTokenQueryToolNames`
- `coreConsensusQueryPlugin` / `coreConsensusQueryToolNames`
- `coreEvmQueryPlugin` / `coreEvmQueryToolNames`
- `coreMiscQueryPlugin` / `coreMiscQueryToolNames`
- `coreTransactionsQueryPlugin` / `coreTransactionsQueryToolNames`

The `hol-audit-trail-hook` is implemented separately as a Node-only subpath (tracked in a different branch).

### Runtime rules

- built-in plugins require explicit opt-in
- empty `configuration.plugins` is valid and produces zero tools
- deprecated compatibility aliases are removed
- `hol-audit-trail-hook` remains Node-only (tracked separately)
- `ResponseParserService` remains public from the LangChain package
- MCP-specific config moves out of core and into toolkit-specific packages

### Consumer workflow

Install core, SDK, and only the toolkit you need.

LangChain example:

```bash
pnpm add @hiero-ledger/sdk @hashgraph/hedera-agent-kit @hashgraph/hedera-agent-kit-langchain
pnpm add @langchain/core langchain @langchain/openai @langchain/mcp-adapters
```

Usage example:

```ts
import { Client, PrivateKey } from '@hiero-ledger/sdk'
import { AgentMode } from '@hashgraph/hedera-agent-kit'
import { coreAccountPlugin, coreTokenPlugin } from '@hashgraph/hedera-agent-kit/plugins'
import {
  HederaLangchainToolkit,
  ResponseParserService,
} from '@hashgraph/hedera-agent-kit-langchain'

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
)

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [coreAccountPlugin, coreTokenPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
})

const tools = toolkit.getTools()
const parser = new ResponseParserService(tools)
```

### Build, test, and release decisions

- published packages ship both ESM and CJS
- each package owns its own unit, integration, and end-to-end tests
- shared test helpers live in `packages/tests/shared`

### Versioning strategy

We considered three approaches:

1. **Lockstep versioning**: every package always publishes the same version
2. **Fully independent versioning**: every package versions freely
3. **Independent versioning with aligned majors**: packages can have different minor and patch versions, but the major version stays aligned across the family

We choose **independent versioning with aligned major versions**.

Example:

- `@hashgraph/hedera-agent-kit@4.2.0`
- `@hashgraph/hedera-agent-kit-langchain@4.5.1`
- `@hashgraph/hedera-agent-kit-ai-sdk@4.1.3`

This keeps package releases flexible while preserving a simple compatibility signal: packages on the same major version are intended to work together.

## Consequences

### Positive

- smaller installs for consumers who only need one toolkit
- lower dependency-conflict risk across framework integrations
- explicit plugin and hook imports
- smaller and clearer root public API
- cleaner package ownership inside the repo
- better separation of package-local tests vs cross-package e2e tests
- a compatibility story that is simpler than fully unconstrained independent versioning

### Negative

- monorepo build and release setup becomes more complex than the current single package
- `semantic-release` monorepo configuration will require care because packages version independently
- contributors need to understand which package owns which code
- docs and examples must be updated to the new install and import paths

### Follow-up work

- implement `hol-audit-trail-hook` subpath export (tracked separately)
- define exact dependency/version compatibility rules between core and toolkit packages
