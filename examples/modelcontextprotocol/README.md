# Hedera MCP Server

This is a Model Context Protocol (MCP) server for Hedera, allowing LLMs to interact with the Hedera network.

## Prerequisites

- Node.js >= 18
- A Hedera Testnet or Mainnet account (Operator ID and Key)

## Installation

1. Navigate to this directory:
   ```bash
   cd modelcontextprotocol
   ```

2. Install dependencies and build:

   ```bash
   npm install
   cd ../../packages/mcp
   npm install
   npm run build
   cd ../../examples/modelcontextprotocol
   ```

3. Build the server:
   ```bash
   npm run build
   ```

## Configuration

The server requires the following environment variables to be set:

- `HEDERA_OPERATOR_ID`: Your Hedera account ID (e.g., `0.0.12345`).
- `HEDERA_OPERATOR_KEY`: Your Hedera private key (DER encoded).

## Usage

### Running Manually

You can run the server directly using Node.js:

```bash
export HEDERA_OPERATOR_ID=0.0.xxx
export HEDERA_OPERATOR_KEY=302e...
node dist/stdio.js --ledger-id=testnet
```

### Supported Arguments

- `--ledger-id`: `testnet` (default) or `mainnet`.
- `--tools`: Comma-separated list of tools to enable (default: all). See [Tools](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/HEDERATOOLS.md) for available tools.
- `--agent-mode`: Set the agent mode (`AUTONOMUS` or `RETURN_BYTES`).
- `--account-id`: Specific account ID context (in format `0.0.?????`).
- `--public-key`: Specific public key context (ECDSA DER encoded).
# Hedera MCP Server Examples

This directory contains examples of how to run a Hedera MCP server using the `@hashgraph/hedera-agent-kit-mcp` adapter.

## Examples

### 1. Stdio Server (`src/stdio.ts`)
A standard MCP server that communicates over stdin/stdout. Ideal for use with Claude Desktop or other MCP clients that spawn the server as a subprocess.

### 2. HTTP Server (`src/http.ts`)
A streaming HTTP MCP server using Express. Supports session-based context and "return bytes" mode for client-side signing.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the package**:
   ```bash
   cd ../../packages/mcp
   npm install
   npm run build
   cd ../../examples/modelcontextprotocol
   ```

3. **Configure environment**:
   Create a `.env` file:
   ```env
   HEDERA_OPERATOR_ID=0.0.xxxx
   HEDERA_OPERATOR_KEY=302e...
   ```

## Running

### Stdio Server
```bash
pnpm start:stdio
```

### HTTP Server
```bash
pnpm start:http
```

### HTTP Server (Return Bytes Mode)
```bash
pnpm start:http:return-bytes
```

## Modular Approach

These examples use the modular approach of the Hedera Agent Kit. They import specific plugins from `@hashgraph/hedera-agent-kit/plugins` and use the `HederaMCPToolkit` adapter from `@hashgraph/hedera-agent-kit-mcp`.

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
