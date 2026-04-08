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

2. Install dependencies:
   ```bash
   npm install
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

### Supported Modes

Modes can be configured by the `--agent-mode` argument. The available modes are `AUTONOMUS` (default) and `RETURN_BYTES`. Read more about [Agent Modes](https://github.com/hashgraph/hedera-agent-kit-js/tree/main?tab=readme-ov-file#agent-execution-modes).

- **`AUTONOMUS`**: In this mode, the MCP server executes transactions on your behalf. You must set the environment variables `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` for the account that will perform the executions.
- **`RETURN_BYTES`**: In this mode, the MCP server returns the unsigned transaction bytes instead of executing them. This is ideal for remote servers availabe for external users, as it does not require operator credentials to be configured. The user must sign and execute the returned transactions using their own private key.

> [!IMPORTANT]
> When using the HTTP server in `RETURN_BYTES` mode, you must provide the account context by passing the `x-hedera-account-id` header in your requests. This ensures the server remains stateless while identifying which account the transactions are being built for. For a complete implementation example using LangChain, see [external-mcp-return-bytes-agent.ts](../typescript/examples/langchain-v1/external-mcp-return-bytes-agent.ts).

### Using with Antigravity / Claude Desktop
#### As a local MCP server
Add the following to your MCP client configuration (e.g., `claude_desktop_config.json` or Antigravity Settings):

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": [
        "{path-to}/hedera-agent-kit-v3/modelcontextprotocol/dist/stdio.js",
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

### Stdio Server Implementation

The `src/stdio.ts` file provides a **Stdio** transport implementation of the MCP server, which is the default for most MCP clients like Claude Desktop.

### HTTP Server Implementation (Experimental)

The `src/http.ts` file provides a **Streamable HTTP** transport implementation of the MCP server.

#### Key Characteristics:
- **Mode**: Currently supports `RETURN_BYTES` mode only.
- **Operator-less**: The server itself does not require `HEDERA_OPERATOR_ID` or `HEDERA_OPERATOR_KEY` to be configured, as it does not execute transactions.
- **Dynamic Context**: Requesters must provide the account context by passing the `x-hedera-account-id` header in the HTTP request.

#### Running the HTTP Server:
```bash
npm run start:http:return-bytes
```

#### Connecting to the HTTP Server:
For an example of how to connect to this server using LangChain, see the [external-mcp-return-bytes-agent.ts](../typescript/examples/langchain-v1/external-mcp-return-bytes-agent.ts) example.
