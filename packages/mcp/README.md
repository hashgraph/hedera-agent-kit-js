# @hashgraph/hedera-agent-kit-mcp

Model Context Protocol (MCP) integration for Hedera Agent Kit. This package ships the `HederaMCPToolkit` class — a reusable `McpServer` subclass that registers every tool produced by your configured plugins. Host it inside your own stdio or HTTP entry point.

> **Part of the Hedera Agent Kit:** This package is an adapter for the core [`@hashgraph/hedera-agent-kit`](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit) SDK.

A complete runnable server (stdio + HTTP transports) lives in [`examples/modelcontextprotocol`](../../examples/modelcontextprotocol).

## Library Usage

```typescript
import { Client } from '@hiero-ledger/sdk';
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

// Connect `server` to a transport (StdioServerTransport, StreamableHTTPServerTransport, etc.)
// See examples/modelcontextprotocol/src/stdio.ts and src/http.ts for reference implementations.
```

## Execution Modes & Key Custody

The example above is **custodial**: the server holds the operator key and signs transactions itself. For servers that should never hold signing material, configure `mode: AgentMode.RETURN_BYTES` and skip `setOperator` — transaction tools then return frozen, unsigned transaction bytes for the calling host app, wallet, or runtime to sign and submit.

See the [MCP server guide](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/MCP.md) for both architectures, response shapes, and a safety checklist.
