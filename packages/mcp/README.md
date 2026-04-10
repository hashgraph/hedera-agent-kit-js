# @hashgraph/hedera-agent-kit-mcp

Model Context Protocol (MCP) integration for Hedera Agent Kit. Provides both a reusable toolkit class and a ready-to-run CLI server.

## Library Usage

```typescript
import { Client } from '@hashgraph/sdk';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import { coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin } from '@hashgraph/hedera-agent-kit/plugins';

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const server = new HederaMCPToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
  },
});
```

## CLI Usage

### Prerequisites

- Node.js >= 18
- A Hedera Testnet or Mainnet account (Operator ID and Key)

### Running the MCP Server

```bash
npx @hashgraph/hedera-agent-kit-mcp --ledger-id=testnet
```

Or install globally:

```bash
npm install -g @hashgraph/hedera-agent-kit-mcp
hedera-agent-kit-mcp --ledger-id=testnet
```

### Environment Variables

Create a `.env` file in your working directory:

```
HEDERA_OPERATOR_ID=0.0.12345
HEDERA_OPERATOR_KEY=302e...
```

### Supported Arguments

- `--ledger-id`: `testnet` (default) or `mainnet`
- `--tools`: Comma-separated list of tools to enable (default: all)
- `--agent-mode`: Set the agent mode
- `--account-id`: Specific account ID context
- `--public-key`: Specific public key context

### Using with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hedera": {
      "command": "npx",
      "args": [
        "@hashgraph/hedera-agent-kit-mcp",
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

For local development, point to the built CLI directly:

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": [
        "<path-to>/hedera-agent-kit-js/packages/mcp/dist/bin/cli.js",
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
