# Hedera MCP Server

This is a runnable Model Context Protocol (MCP) server for Hedera, with stdio and HTTP transports.

> [!IMPORTANT]
> For the concepts behind this example — custodial vs. non-custodial architecture, `RETURN_BYTES` mode, key custody, response shapes, and connecting from Claude Desktop or remote MCP clients — see **[docs/MCP.md](../../docs/MCP.md)**. This README only covers running the example.

## Prerequisites

- Node.js >= 18
- A Hedera Testnet or Mainnet account (Operator ID and Key) — only needed for the stdio (custodial) server

## Installation & Setup

Choose the appropriate setup flow based on your `package.json` configuration.

### 1. Standard Installation (NPM)
Use this flow if you are using versioned packages from npm (e.g., `"@hashgraph/hedera-agent-kit": "v4.x.x"`).

```bash
# Install dependencies
npm install

# Build the server
npm run build
```

### 2. Local Development (Linked Packages)
Use this flow if you are developing locally and have linked the core packages using `file:` links (e.g., `"@hashgraph/hedera-agent-kit": "file:../../packages/core"`).

```bash
# 1. Build the MCP package
cd ../../packages/mcp
npm install
npm run build

# 2. Setup the example
cd ../../examples/modelcontextprotocol
npm install
npm run build
```

## Configuration

The stdio server requires a `.env` file or environment variables:
```env
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=3030...
```

The HTTP server takes no credentials — it is designed for the non-custodial `RETURN_BYTES` mode (see [docs/MCP.md](../../docs/MCP.md#non-custodial-setup-http--return_bytes)).

## Supported Arguments

- `--ledger-id`: `testnet` (default) or `mainnet`.
- `--tools`: Comma-separated list of tools to enable. If omitted, all tools from the registered plugins are loaded by default.
- `--agent-mode`: Set the agent mode (`AUTONOMOUS`, `RETURN_BYTES`, or `CUSTOM`).
- `--account-id`: Specific account ID context (in format `0.0.?????`).
- `--public-key`: Specific public key context (ECDSA DER encoded).

## Running

### Stdio Server (custodial — signs with the operator key)
```bash
npm run start:stdio
```

### HTTP Server (non-custodial — returns unsigned transaction bytes)
```bash
npm run start:http:return-bytes
```

> [!WARNING]
> The HTTP server (`http.ts`) does not set an operator on the Hedera client, so it only works in `RETURN_BYTES` mode. The plain `npm start:http` command will fail on every transaction tool call — see [docs/MCP.md](../../docs/MCP.md#non-custodial-setup-http--return_bytes) for the explanation.

> [!NOTE]
> The `start:*` scripts in `package.json` do not specify a `--tools` array. Therefore, they will load all available tools from the Hedera Agent Kit SDK by default.

## Modular Approach

These examples use the modular approach of the Hedera Agent Kit and are **currently configured to load all 10 available core plugins**. They import specific tool name objects from `@hashgraph/hedera-agent-kit/plugins` for dynamic validation and use the `HederaMCPToolkit` adapter.

```typescript
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import { coreTokenPlugin, coreAccountPlugin } from '@hashgraph/hedera-agent-kit/plugins';

const server = new HederaMCPToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin],
  },
});
```

---

## See Also

- **[docs/MCP.md](../../docs/MCP.md)**: Architecture guide — key custody, `RETURN_BYTES`, client configuration (Claude Desktop, remote), response shapes, safety checklist.
- **[LangChain Integration (Return-Bytes)](../langchain-v1/external-mcp-return-bytes-agent.ts)**: A complete client that connects to this server in `RETURN_BYTES` mode and signs/executes the returned transaction bytes locally.
