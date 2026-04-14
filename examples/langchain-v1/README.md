# Hedera Agent Kit – LangChain v1 Examples

This directory contains examples of using the **Hedera Agent Kit** with **LangChain v1**.

For more developer-oriented examples and deeper explanations, see the [Developer Examples documentation](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md).

> [!IMPORTANT]
> **Migrating from v3 to v4?** Check out our [Migration Guide](../../docs/MIGRATION-v4.md).
> 
> **Note on Plugins:** Starting with v4, you must **explicitly pass all plugins** in the configuration. An empty plugin array will no longer result in all default tools being imported. For more details, see [Explicit Plugin Opt-In](https://github.com/hashgraph/hedera-agent-kit-js/blob/feat/release/16.04/docs/MIGRATION-v4.md#4-explicit-plugin-opt-in-behavioral-change).

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



### Return Bytes Agent (External MCP)

```bash
npm run langchain:external-mcp-return-bytes-agent
```

An agent that demonstrates connecting to the [Hedera HTTP MCP server](../modelcontextprotocol/src/http.ts) running in `RETURN_BYTES` mode. This example is specifically designed to demonstrate integration with the modular HTTP return-bytes MCP implementation found in the [modelcontextprotocol examples](../modelcontextprotocol/src/http.ts). It shows how to pass account context via HTTP headers and handle transaction bytes returned from the server for local signing.

> [!IMPORTANT]
> **The MCP server must be started with the `--agent-mode=returnBytes` flag** (i.e. `npm run start:http:return-bytes` in the `modelcontextprotocol` directory) before running this agent. The HTTP server does not configure an operator on its Hedera client, so without `RETURN_BYTES` mode the default `ExecuteStrategy` is active and all transaction tools will fail with:
> ```
> `transactionId` must be set or `client` must be provided with `freezeWith`
> ```
> This error indicates the SDK cannot auto-generate a transaction ID (no operator on the server-side client) and no ID was pre-set, which only happens when the server is **not** in `RETURN_BYTES` mode.

---

## External MCP Agent Example

This example demonstrates how to use the Hedera Agent Kit with an **external MCP (Model Context Protocol) server** to access Hedera blockchain tools.

### Setup

#### 1. Set Up the MCP Server

Follow the setup instructions in the [modelcontextprotocol README](../modelcontextprotocol/README.md) to build the Hedera MCP server:

```bash
cd examples/modelcontextprotocol
npm install
cd ../../packages/mcp
npm install
npm run build
cd ../../examples/modelcontextprotocol
```

---

#### 2. Configure Environment Variables

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

The Hedera Agent Kit supports **DER-encoded private keys** by default. To use **hex-encoded keys** instead, uncomment the appropriate line in `external-mcp-agent.ts`:

```ts
PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

For more information about Hedera key types and formats, see the [Hedera documentation on Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).

---

#### 3. Update MCP Server Path

Open `external-mcp-agent.ts` and update the `args` array with the **absolute path** to your MCP server build output:

```ts
args: [
  '<YOUR PATH TO>/hedera-agent-kit-js/examples/modelcontextprotocol/dist/stdio.js',
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

For more developer examples, see the [Developer Examples documentation](../../docs/DEVEXAMPLES.md).
