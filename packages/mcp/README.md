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

See [examples](file:///home/stanislawkurzyp/Documents/arianelabs/hedera-agent-kit-v3/examples/modelcontextprotocol) for full implementations.
