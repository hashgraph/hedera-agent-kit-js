# Hedera Agent Kit – LangChain v1 Examples

This directory contains examples of using the **Hedera Agent Kit** with **LangChain v1**.

For more developer-oriented examples and deeper explanations, see the [Developer Examples documentation](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md).

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

## External MCP Agent Example

This example demonstrates how to use the Hedera Agent Kit with an **external MCP (Model Context Protocol) server** to access Hedera blockchain tools.

### Setup

#### 1. Set Up the MCP Server

Follow the setup instructions in the [modelcontextprotocol README](../../../modelcontextprotocol/README.md) to build the Hedera MCP server:

```bash
cd ../../../modelcontextprotocol
npm install
npm run build
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
  '<YOUR PATH TO>/hedera-agent-kit-v3/modelcontextprotocol/dist/index.js',
  '--ledger-id=testnet',
],
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

---

### What This Example Does

This example shows how to integrate **external MCP (Model Context Protocol) servers** with the Hedera Agent Kit.

The agent combines:

* **A single local plugin** (`coreMiscQueriesPlugin`) from the Hedera toolkit
* **Additional tools** exposed by a remote MCP server

The Hedera MCP server included in this repository is used as a reference implementation, but you can integrate other MCP servers by modifying the `mcpServers` configuration.

#### Integrating Other MCP Servers

To connect to different MCP server transports (HTTP, SSE, WebSocket, etc.), update the `mcpServers` configuration in `external-mcp-agent.ts`.

For more details, see the [LangChain MCP Adapters documentation](https://reference.langchain.com/python/langchain_mcp_adapters/#langchain_mcp_adapters.client).

---

### Capabilities

With the combined toolset, the agent can perform a wide range of Hedera blockchain operations, including:

* Querying account balances
* Creating fungible and non-fungible tokens
* Submitting messages to topics
* Transferring HBAR
* And more

---

## Reference

For additional examples and patterns, see the [Developer Examples documentation](../../../docs/DEVEXAMPLES.md).
