# Building MCP Servers with the Hedera Agent Kit

The [`@hashgraph/hedera-agent-kit-mcp`](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit-mcp) package ships `HederaMCPToolkit`, an `McpServer` subclass that exposes every tool from your configured plugins over the Model Context Protocol. This guide explains the two architectures you can build with it — and in particular how to run a server that **never holds signing keys**.

> [!NOTE]
> This page is about **hosting your own** MCP server. For connecting to third-party MCP servers from the Hedera ecosystem (Hederion, Hgraph), see [HEDERAMCPS.md](HEDERAMCPS.md).

## Contents

- [Two architectures: who holds the keys?](#two-architectures-who-holds-the-keys)
- [Custodial setup (stdio + AUTONOMOUS)](#custodial-setup-stdio--autonomous)
- [Non-custodial setup (HTTP + RETURN_BYTES)](#non-custodial-setup-http--return_bytes)
- [What a transaction tool returns](#what-a-transaction-tool-returns)
- [Signing and submitting on the client](#signing-and-submitting-on-the-client)
- [Recommended response shape for custom byte-returning tools](#recommended-response-shape-for-custom-byte-returning-tools)
- [Safety checklist](#safety-checklist)

## Two architectures: who holds the keys?

The kit has two execution modes (`AgentMode` in `@hashgraph/hedera-agent-kit`), and the mode decides where the private key lives:

|                   | Custodial — `AUTONOMOUS`                         | Non-custodial — `RETURN_BYTES`                                   |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Signing key       | On the MCP server (operator set on the `Client`) | Never on the server; stays in the host app, wallet, or runtime   |
| Transaction flow  | Server signs **and submits** every transaction   | Server freezes the transaction and returns unsigned bytes        |
| Typical transport | stdio, running locally for a single user         | HTTP, potentially remote and shared by many callers              |
| Account context   | Operator account from env vars                   | Per-request, via the `x-hedera-account-id` header (stateless)    |
| Use when          | Personal local agent, quick testnet experiments  | Serving third parties, payment/x402 agents, anything user-facing |

**Default to `RETURN_BYTES` for anything user-facing.** A server that cannot sign cannot lose funds, and the human (or host application) keeps the final approval step: the agent prepares a transaction plan, the operator decides when and where it gets signed and submitted.

## Custodial setup (stdio + AUTONOMOUS)

The server holds an operator account and executes transactions itself. Provide credentials via a `.env` file or environment variables:

```env
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=3030...
```

```typescript
import { Client } from '@hiero-ledger/sdk';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';

const client = Client.forTestnet();
client.setOperator(process.env.HEDERA_OPERATOR_ID!, process.env.HEDERA_OPERATOR_KEY!);

const server = new HederaMCPToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
  },
});
// Connect `server` to a StdioServerTransport — see examples/modelcontextprotocol/src/stdio.ts
```

### Connecting from Claude Desktop or an IDE

Add the server to your MCP client configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hedera": {
      "command": "node",
      "args": [
        "{path-to}/hedera-agent-kit-js/examples/modelcontextprotocol/dist/stdio.js",
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

> [!WARNING]
> In this configuration the MCP client config file contains your private key and the server signs transactions autonomously. Use a testnet account, and prefer the non-custodial setup below for anything beyond local experiments.

## Non-custodial setup (HTTP + RETURN_BYTES)

The server builds transactions but cannot sign them: no operator is ever set on the `Client`, and every transaction tool returns frozen, unsigned transaction bytes instead of executing.

```typescript
import { Client } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import { coreConsensusPlugin, coreAccountQueryPlugin } from '@hashgraph/hedera-agent-kit/plugins';

const client = Client.forTestnet(); // no setOperator — the server holds no keys

const server = new HederaMCPToolkit({
  client,
  configuration: {
    context: {
      mode: AgentMode.RETURN_BYTES,
      accountId: callerAccountId, // whose account the transaction is built for
    },
    plugins: [coreConsensusPlugin, coreAccountQueryPlugin],
  },
});
// Connect `server` to a StreamableHTTPServerTransport — see examples/modelcontextprotocol/src/http.ts
```

### Per-request account context

`RETURN_BYTES` mode requires `accountId` in the context — it is used to generate the transaction ID before freezing. For an HTTP server shared by many callers, do not hard-code it: read it from the `x-hedera-account-id` header when a session initializes and build the toolkit with that per-session context. This keeps the server stateless while identifying which account each transaction is built for. The reference implementation in [`examples/modelcontextprotocol/src/http.ts`](../examples/modelcontextprotocol/src/http.ts) does exactly this (and also resolves the account's public key from the mirror node).

A remote MCP client then connects like this:

```json
{
  "mcpServers": {
    "hedera": {
      "url": "http://remote-server-address:port/mcp",
      "headers": {
        "x-hedera-account-id": "0.0.YOUR_ACCOUNT_ID"
      }
    }
  }
}
```

> [!WARNING]
> A client without an operator cannot execute transactions. If you run a no-operator server **without** `mode: AgentMode.RETURN_BYTES`, the default execute strategy is used and every transaction tool call fails with:
>
> ```
> `transactionId` must be set or `client` must be provided with `freezeWith`
> ```
>
> This error means the SDK could not auto-generate a transaction ID (no operator) and none was pre-set (not in return-bytes mode). No keys and no return-bytes mode is a broken combination — pick one side of the table above.

## What a transaction tool returns

In `RETURN_BYTES` mode, a transaction tool:

1. builds the transaction from the tool arguments,
2. sets a transaction ID generated from `context.accountId`,
3. freezes it against the client,
4. returns a `ReturnBytesResult` envelope — the serialized, **unsigned** transaction (`bytes`, a `Uint8Array` from `Transaction.toBytes()`) together with the context a wallet needs to review and sign it:

| Field            | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `bytes`          | Frozen, unsigned transaction (`Uint8Array`).                                              |
| `status`         | Always `'SUCCESS'` — serializing to bytes cannot fail once the transaction is frozen.     |
| `transactionId`  | ID set on the frozen transaction, e.g. `0.0.1234@1700000000.000000000`.                   |
| `payerAccountId` | Account expected to pay for and sign the transaction (the context account).               |
| `type`           | SDK transaction class name, e.g. `TransferTransaction`.                                   |
| `expiresAt`      | ISO timestamp after which the network rejects the transaction with `TRANSACTION_EXPIRED`. |
| `memo`           | Transaction memo; empty string when unset.                                                |

Nothing is signed and nothing is submitted. (Query tools are unaffected by the mode — they always just return data.)

What the caller sees depends on the integration layer:

- **Over MCP**, tool results are JSON text, so the `Uint8Array` arrives JSON-serialized; parse the result and reconstruct the bytes before deserializing (see the client example below).
- **In-process framework toolkits** (LangChain, AI SDK) parse tool output into `{ raw, humanMessage }`, where `raw` is the `ReturnBytesResult` envelope (`raw.bytes` is a `Uint8Array`, alongside `raw.transactionId`, `raw.payerAccountId`, `raw.type`, `raw.expiresAt`, and `raw.memo`). Since v4 the bytes are standardized to `Uint8Array` across Node.js and web — if you previously parsed Node `Buffer` payloads, see the [migration guide](MIGRATION-v4.md#9-return_bytes-mode---rawbytes-standardized-to-uint8array).

## Signing and submitting on the client

The host application, wallet, or runtime deserializes the bytes, signs with its own key, and submits:

```typescript
import { Client, Transaction } from '@hiero-ledger/sdk';

const signingClient = Client.forTestnet().setOperator(myAccountId, myPrivateKey);

const tx = Transaction.fromBytes(bytes); // bytes reconstructed from the tool result
const result = await tx.execute(signingClient); // signs with the operator key and submits
const receipt = await result.getReceipt(signingClient);
```

For a complete, runnable agent that connects to the HTTP server in `RETURN_BYTES` mode, parses tool results, and signs locally, see [`examples/langchain-v1/external-mcp-return-bytes-agent.ts`](../examples/langchain-v1/external-mcp-return-bytes-agent.ts).

## Recommended response shape for custom byte-returning tools

If you build your own MCP tools that return prepared transactions (e.g. a receipt or payment plan for an x402-style agent), the core kit does not impose a response contract beyond `{ bytes }`. As a convention, a self-describing envelope makes results reviewable by both machines and humans:

```json
{
  "network": "testnet",
  "transactionBytesBase64": "CtIBCk4KGQoMCPT...",
  "summary": "Submit HCS receipt memo to topic 0.0.12345",
  "requires": {
    "topicId": "0.0.12345",
    "estimatedFeeHbar": "0.0001"
  },
  "safetyNote": "This transaction is NOT signed and has NOT been submitted. Review the summary, then sign and submit it with your own key."
}
```

Guidelines:

- **Base64-encode the bytes** (`Buffer.from(tx.toBytes()).toString('base64')`) — raw `Uint8Array` values do not survive JSON transport cleanly.
- **Name the network** so the signer cannot accidentally submit testnet bytes to mainnet tooling (the bytes themselves would fail, but a clear label saves debugging).
- **State prerequisites** the signer must satisfy (existing topic ID, token association, fee expectations).
- **Include a human-readable safety note** saying the transaction is unsigned and unsubmitted — MCP results are often rendered directly to end users.

This is a recommendation, not an API contract — adapt the fields to your use case.

## See also

- [`examples/modelcontextprotocol`](../examples/modelcontextprotocol) — runnable stdio + HTTP server (both modes)
- [`examples/langchain-v1/external-mcp-return-bytes-agent.ts`](../examples/langchain-v1/external-mcp-return-bytes-agent.ts) — client-side signing agent
- [PLUGINS.md](PLUGINS.md) — writing your own tools (including smoke-testing them in `RETURN_BYTES` mode without any credentials)
- [HEDERAMCPS.md](HEDERAMCPS.md) — third-party ecosystem MCP servers
