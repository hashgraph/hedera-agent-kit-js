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
node dist/index.js --ledger-id=testnet
```

### Supported Arguments

- `--ledger-id`: `testnet` (default) or `mainnet`.
- `--tools`: Comma-separated list of tools to enable (default: all).
- `--agent-mode`: Set the agent mode.
- `--account-id`: Specific account ID context.
- `--public-key`: Specific public key context.

### Using with Antigravity / Claude Desktop

Add the following to your MCP client configuration (e.g., `claude_desktop_config.json` or Antigravity Settings):

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": [
        "{path-to}/hedera-agent-kit-v3/modelcontextprotocol/dist/index.js",
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
