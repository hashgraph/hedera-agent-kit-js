# @hashgraph/hedera-agent-kit-mcp

Model Context Protocol (MCP) integration for Hedera Agent Kit. This package ships the `HederaMCPToolkit` class — a reusable `McpServer` subclass that registers every tool produced by your configured plugins. Host it inside your own stdio or HTTP entry point.

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
