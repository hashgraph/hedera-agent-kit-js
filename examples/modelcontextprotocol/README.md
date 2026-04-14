# Hedera MCP Server

This is a Model Context Protocol (MCP) server for Hedera, allowing LLMs to interact with the Hedera network.

## Prerequisites

- Node.js >= 18
- A Hedera Testnet or Mainnet account (Operator ID and Key)

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

The server requires a `.env` file or environment variables:
```env
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=302e...
```

## Supported Arguments

- `--ledger-id`: `testnet` (default) or `mainnet`.
- `--tools`: Comma-separated list of tools to enable. If omitted, all tools from the registered plugins are loaded by default.
- `--agent-mode`: Set the agent mode (`AUTONOMUS` or `RETURN_BYTES`).
- `--account-id`: Specific account ID context (in format `0.0.?????`).
- `--public-key`: Specific public key context (ECDSA DER encoded).


## Running

### Stdio Server
```bash
npm run start:stdio
```

### HTTP Server (Return Bytes Mode)
```bash
npm run start:http:return-bytes
```

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

> [!IMPORTANT]
> When using the HTTP server in `RETURN_BYTES` mode, you must provide the account context by passing the `x-hedera-account-id` header in your requests. This ensures the server remains stateless while identifying which account the transactions are being built for. For a complete implementation example using LangChain, see [external-mcp-return-bytes-agent.ts](../examples/langchain-v1/external-mcp-return-bytes-agent.ts).

### Using with Antigravity / Claude Desktop
#### As a local MCP server
Add the following to your MCP client configuration (e.g., `claude_desktop_config.json` or Antigravity Settings):

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": [
        "{path-to}/hedera-agent-kit/examples/modelcontextprotocol/dist/stdio.js",
        "--ledger-id=testnet"
      ],
      "env": {
        "HEDERA_OPERATOR_ID": "0.0.YOUR_ACCOUNT_ID",
        "HEDERA_OPERATOR_KEY": "YOUR_PRIVATE_KEY"
      }
    }
  }
}
```

Replace `0.0.YOUR_ACCOUNT_ID` and `YOUR_PRIVATE_KEY` with your actual Hedera credentials.
This configuration will start the server locally and connect the client app to it.

#### As a remote MCP server
If you want to run the server on a remote machine, ensure it is accessible over the network and update the client configuration to point to the server's address:

```json
{
  "mcpServers": {
    "hedera": {
      "url": "http://remote-server-address:port/mcp",
      "headers": {
        "x-hedera-account-id": "0.0.YOUR_ACCOUNT_ID"
      }
    }
  }
}
```

---

## See Also

- **[LangChain Integration (Return-Bytes)](../langchain-v1/external-mcp-return-bytes-agent.ts)**: A complete implementation example using LangChain that connects to this MCP server in `RETURN_BYTES` mode. It includes logic for parsing the returned tool results and signing/executing transaction bytes locally.
