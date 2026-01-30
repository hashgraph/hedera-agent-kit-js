# External MCP Agent Example

This example demonstrates how to use the Hedera Agent Kit with an external MCP (Model Context Protocol) server to access Hedera blockchain tools.

## Setup

### 1. Set up the MCP Server

First, follow the setup instructions in the [modelcontextprotocol README](../../../modelcontextprotocol/README.md) to build the Hedera MCP server:

```bash
cd ../../../modelcontextprotocol
npm install
npm run build
```

### 2. Configure Environment Variables

Create a `.env` file in the `typescript/examples/langchain-v1` directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Add your Hedera credentials and OpenAI API key:

```env
ACCOUNT_ID=0.0.xxxxx
PRIVATE_KEY=302e...
OPENAI_API_KEY=sk-proj-...
```

#### About Private Keys

The Hedera Agent Kit supports DER-encoded private keys by default. To use hex-encoded keys instead, uncomment the appropriate line in `external-mcp-agent.ts`:

```typescript
PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

For more information about Hedera key types and formats, see the [Hedera documentation on Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).

### 3. Update MCP Server Path

Open `external-mcp-agent.ts` and update the `args` array with the absolute path to your MCP server:

```typescript
args: [
  '<YOUR PATH TO>/hedera-agent-kit-v3/modelcontextprotocol/dist/index.js',
  '--ledger-id=testnet',
],
```

## How to Run

Install dependencies:

```bash
npm install
```

Run the external MCP agent:

```bash
npm run langchain:external-mcp-agent
```

### Preconfigured MCP Client Agent

This agent uses a preconfigured MCP client to connect to Hedera network:

```bash
npm run langchain:preconfigured-mcp-client-agent
```

## What This Example Does

This example demonstrates how to integrate external MCP (Model Context Protocol) servers with the Hedera Agent Kit. It creates an agent that combines:
- **A single plugin** (`coreMiscQueriesPlugin`) from the local Hedera toolkit
- **Additional tools** from a remote MCP server

The Hedera MCP server from this repository is used as an example, but you can easily integrate other MCP servers by modifying the `mcpServers` configuration.

### Integrating Other MCP Servers

To connect to different types of MCP servers (HTTP, SSE, WebSocket, etc.), update the `mcpServers` configuration in `external-mcp-agent.ts`. See the [LangChain MCP Adapters documentation](https://reference.langchain.com/python/langchain_mcp_adapters/#langchain_mcp_adapters.client) for details on configuring different MCP connection types.

The combined agent can perform various Hedera blockchain operations such as:
- Querying account balances
- Creating fungible and non-fungible tokens
- Submitting messages to topics
- Transferring HBAR
- And more...

## Reference

For more developer examples, see the [Developer Examples documentation](../../../docs/DEVEXAMPLES.md).
