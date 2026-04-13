# Hedera Agent Kit – LangChain v1 Examples

This directory contains examples of using the **Hedera Agent Kit** with **LangChain v1**.

For more developer-oriented examples and deeper explanations, see the [Developer Examples documentation](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md).

> [!IMPORTANT]
> **Migrating from v3 to v4?** Check out our [Migration Guide](../../docs/MIGRATION-v4.md).
> 
> **Note on Plugins:** Starting with v4, you must **explicitly pass all plugins** in the configuration. An empty plugin array will no longer result in all default tools being imported. For more details, see [Explicit Plugin Opt-In](https://github.com/hashgraph/hedera-agent-kit-js/blob/feat/release/16.04/docs/MIGRATION-v4.md#4-explicit-plugin-opt-in-behavioral-change).

---

## Setup

### 1. Set Up the MCP Server

Build the Hedera MCP server from the repository root:

```bash
pnpm --filter @hashgraph/hedera-agent-kit-mcp build
```

---

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

##### About Private Keys

Hedera supports both **ECDSA** and **ED25519** private keys. The examples use **ECDSA** by default. To use an **ED25519** key, uncomment the appropriate line in the agent's `.ts` file:

```ts
PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

For more information about Hedera key types and formats, see the [Hedera documentation on Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).

---

## Available Agents

### Plugin Tool Calling Agent

```bash
npm run langchain:plugin-tool-calling-agent
```

An agent that uses plugins for tool discovery and execution.

---

### Return Bytes Agent (Human-in-the-Loop)

```bash
npm run langchain:return-bytes-tool-calling-agent
```

An agent that returns transaction bytes for **manual signing and execution**, rather than submitting transactions directly.

---

### Return Bytes Agent (Web / Robust Parsing)

```bash
npm run langchain:return-bytes-tool-calling-agent-web
```

A variant of the Return Bytes agent with **robust parsing logic** for handling multiple Buffer serialization formats (for example, browser `Uint8Array` and JSON-serialized buffers).

---

### Policy Enforcement Agent

```bash
npm run langchain:policy-enforcement-agent
```

An agent that demonstrates **MaxRecipientsPolicy** enforcement, restricting transfers to a maximum of 2 recipients.

---

### Audit Trail Agent

```bash
npm run langchain:audit-trail-agent
```

An agent that demonstrates **HcsAuditTrailHook**, automatically auditing specific actions (like HBAR transfers or token creation) to a Hedera Consensus Service (HCS) topic.

> [!IMPORTANT]
> This agent works only in `mode: AgentMode.AUTONOMOUS`.


---

## External MCP Agent Example

This example demonstrates how to use the Hedera Agent Kit with an **external MCP (Model Context Protocol) server** to access Hedera blockchain tools.

---

### MCP Agent Configuration

#### 1. Update MCP Server Path

Open `external-mcp-agent.ts` and update the `args` array with the **absolute path** to your MCP server build output:

```ts
args: [
  '<YOUR PATH TO>/hedera-agent-kit-js/packages/mcp/dist/bin/cli.js',
  '--ledger-id=testnet',
]
```

---

### How to Run

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

#### Hgraph MCP Server Configuration

To use the **Hgraph MCP Server** (`HederaMCPServer.HGRAPH_MCP_MAINNET`), you must obtain an API key:

1. Visit [docs.hgraph.com](https://docs.hgraph.com/mcp-server/setup-claude) to learn how to obtain your `HGRAPH_API_KEY`.
2. Add the key to your `.env` file:

```env
HGRAPH_API_KEY=your_api_key_here
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
