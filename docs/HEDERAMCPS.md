# Hedera Ecosystem MCP Servers

The Hedera Agent Kit provides easy access to MCP servers hosted by affiliated ecosystem partners. These servers extend your agent's capabilities with specialized tools for network interaction, data indexing, and more.

> [!NOTE]
> These services are provided by third-party partners and are not directly managed by the Hedera Agent Kit team.

## Configuration

These servers are preconfigured in the `HederaMCPServer` enum and can be loaded directly into your agent configuration:

```typescript
import { HederaMCPServer } from 'hedera-agent-kit';

const toolkit = new HederaLangchainToolkit({
  configuration: {
    // ...
    mcpServers: [
      HederaMCPServer.HEDERION_MCP_MAINNET,
      // or
      HederaMCPServer.HGRAPH_MCP_MAINNET
    ]
  }
});

// Explicitly fetch tools from the configured MCP servers
const mcpTools = await toolkit.getMcpTools();
```

## Examples

You can find complete working examples of how to use preconfigured MCP clients in the following files:

- **LangChain v1**: [`typescript/examples/langchain-v1/preconfigured-mcp-client-agent.ts`](../typescript/examples/langchain-v1/preconfigured-mcp-client-agent.ts)
- **AI SDK**: [`typescript/examples/ai-sdk/preconfigured-mcp-client-agent.ts`](../typescript/examples/ai-sdk/preconfigured-mcp-client-agent.ts)

> [!NOTE]
> MCP tool support is only available for LangChain v1 and Vercel AI SDK. Legacy LangChain (Classic) is not supported.

In these examples, notice that `getMcpTools()` matches the pattern shown above. This explicit fetching ensures that external tools are strictly loaded only when requested, preventing initialization race conditions.

## Available Servers

### Hederion
Hederion provides a powerful suite of tools for interacting with the Hedera network, including advanced transaction handling and data querying.

- **Mainnet**: `HederaMCPServer.HEDERION_MCP_MAINNET`
- **Testnet**: `HederaMCPServer.HEDERION_MCP_TESTNET` (Currently unavailable)

**Site**: [hederion.com](https://hederion.com)

---

### Hgraph
Hgraph offers comprehensive indexing and query capabilities for Hedera data.

- **Mainnet**: `HederaMCPServer.HGRAPH_MCP_MAINNET`
- **Testnet**: `HederaMCPServer.HGRAPH_MCP_TESTNET`

**Documentation**: [docs.hgraph.com/category/hgraph-mcp-server](https://docs.hgraph.com/category/hgraph-mcp-server)
