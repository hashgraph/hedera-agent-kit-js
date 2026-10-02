# Hedera Ecosystem MCP Servers

The Hedera Agent Kit provides easy access to MCP servers hosted by affiliated ecosystem partners. These servers extend your agent's capabilities with specialized tools for network interaction, data indexing, and more.

> [!NOTE]
> Hederion and Hgraph are provided by third-party partners and are not directly managed by the Hedera Agent Kit team. The Hedera Network MCP is the hosted Hedera Agent Kit server run by Hedera; it needs a wallet sign-in (see below).

## Configuration

These servers are preconfigured in the `HederaMCPServer` enum and can be loaded directly into your agent configuration:

```typescript
import { HederaLangchainToolkit, HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';

const toolkit = new HederaLangchainToolkit({
  configuration: {
    // ...
    mcpServers: [
      HederaMCPServer.HEDERION_MCP_MAINNET,
      // or
      HederaMCPServer.HGRAPH_MCP_MAINNET
      // The hosted Hedera Network MCP (testnet) also needs `mcpAuth` — see "Hedera Network MCP" below
    ]
  }
});

// Explicitly fetch tools from the configured MCP servers
const mcpTools = await toolkit.getMcpTools();
```

## Examples

You can find complete working examples of how to use preconfigured MCP clients in the following files:

- **LangChain v1**: [`examples/langchain-v1/preconfigured-mcp-client-agent.ts`](../examples/langchain-v1/preconfigured-mcp-client-agent.ts)
- **AI SDK**: [`examples/ai-sdk/preconfigured-mcp-client-agent.ts`](../examples/ai-sdk/preconfigured-mcp-client-agent.ts)

For the hosted Hedera Network MCP with wallet sign-in:

- **LangChain v1**: [`examples/langchain-v1/hedera-network-mcp-agent.ts`](../examples/langchain-v1/hedera-network-mcp-agent.ts)
- **AI SDK**: [`examples/ai-sdk/hedera-network-mcp-agent.ts`](../examples/ai-sdk/hedera-network-mcp-agent.ts)

> [!NOTE]
> MCP tool support is only available for LangChain v1 and Vercel AI SDK. Legacy LangChain (Classic) is not supported.

In these examples, notice that `getMcpTools()` matches the pattern shown above. This explicit fetching ensures that external tools are strictly loaded only when requested, preventing initialization race conditions.

## Available Servers

### Hederion
Hederion provides a powerful suite of tools for interacting with the Hedera network, including advanced transaction handling and data querying.

- **Mainnet**: `HederaMCPServer.HEDERION_MCP_MAINNET`

**Site**: [hederion.com](https://hederion.com)

---

### Hgraph
Hgraph offers comprehensive indexing and query capabilities for Hedera data.

- **Mainnet**: `HederaMCPServer.HGRAPH_MCP_MAINNET` (Requires `HGRAPH_API_KEY`)

**Setup**:
To use the Hgraph MCP server, you need an API key.
1. Get your key: [docs.hgraph.com/mcp-server/setup-claude](https://docs.hgraph.com/mcp-server/setup-claude)
2. Set `HGRAPH_API_KEY` in your environment variables.

**Documentation**: [docs.hgraph.com/category/hgraph-mcp-server](https://docs.hgraph.com/category/hgraph-mcp-server)

---

### Hedera Network MCP (hosted, wallet sign-in)
A managed, remote instance of the Hedera Agent Kit run by Hedera, exposing the core plugins (accounts, HTS, EVM, HCS, network queries) over MCP.

- **Testnet only**: `HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET` (`https://agentic-testnet-mcp.hedera.com/mcp`). For mainnet, [self-host the MCP server](./MCP.md).

**This is not a plain MCP server.** It is non-custodial and requires OAuth 2.1 sign-in with a wallet:

1. The first request is rejected with `401`, which starts the OAuth flow (dynamic client registration, so no client ID is needed).
2. The user opens the Hedera sign-in page, pairs a wallet via WalletConnect (HashPack, Kabila, ...) and signs a single-use sign-in message. No funds move.
3. The server issues an access token scoped to that account.

The server never holds keys and never submits transactions. There is no `x-hedera-account-id` header or API key; that header is **ignored** by the hosted server. The account comes from the wallet sign-in.

**Using it from the toolkit.** Because the server needs sign-in, `mcpServers` alone is not enough: pass an OAuth client provider and a way to receive the authorization code through `mcpAuth`. `getMcpTools()` runs the sign-in (opening the browser) before connecting, and throws a clear error if `mcpAuth` is missing for this server.

```typescript
import { HederaLangchainToolkit, HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';
// NOT part of the kit: copy this helper from the examples (see below)
import {
  InMemoryOAuthClientProvider,
  startOAuthCallbackServer,
} from './utils/hedera-network-mcp-auth';

const callbackServer = startOAuthCallbackServer(); // local server listening on http://127.0.0.1:8090/callback

const toolkit = new HederaLangchainToolkit({
  client, // Client.forTestnet() — no operator is needed, the wallet signs
  configuration: {
    plugins: [],
    mcpServers: [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET],
    mcpAuth: {
      [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]: {
        authProvider: new InMemoryOAuthClientProvider(),
        waitForAuthorizationCode: callbackServer.waitForCode, // resolves with the `code` sent to the redirect URL
      },
    },
  },
});

const mcpTools = await toolkit.getMcpTools(); // opens the wallet sign-in on first use
callbackServer.close();
```

**Where `authProvider` and `waitForAuthorizationCode` come from.** The kit does not ship them; you supply both (the kit only exports the `MCPServerOAuthOptions` / `MCPServerAuthMap` types and `ensureMcpAuthorized`).
- `authProvider` is any implementation of the MCP SDK's `OAuthClientProvider` (`@modelcontextprotocol/sdk/client/auth.js`). It stores the dynamically registered client, tokens and PKCE verifier, declares the redirect URL, and opens the sign-in URL in `redirectToAuthorization`.
- `waitForAuthorizationCode` is a function returning a promise that resolves with the `code` query parameter that the sign-in page redirects to your `redirectUrl`. Typically a small local HTTP server, or your app's own callback route.

Ready-made versions of both (an in-memory provider and a local callback server) live in [`examples/langchain-v1/utils/hedera-network-mcp-auth.ts`](../examples/langchain-v1/utils/hedera-network-mcp-auth.ts) and [`examples/ai-sdk/utils/hedera-network-mcp-auth.ts`](../examples/ai-sdk/utils/hedera-network-mcp-auth.ts); copy one into your project.

`HederaAIToolkit` (AI SDK) takes the same `mcpAuth` option. Tokens are in-memory in the example provider, so the wallet sign-in repeats on each run; persist them in your own provider if you want the session to survive restarts.

**Transactions are asynchronous.** Write tools build and freeze a transaction, deliver it to the wallet, and return `{ requestId, summary, walletVerifiable }` instead of an execution result. The agent then checks the outcome with `check_signing_status({ requestId })`:

| Status | Meaning |
| :- | :- |
| `awaiting_approval` | Delivered to the wallet; waiting for the user |
| `confirming` | The wallet broadcast it; the server is checking the mirror node |
| `executed` | Confirmed on the mirror node |
| `rejected` | The user declined it in the wallet |
| `failed` | Reached the network but failed on-chain |
| `expired` | The ~180 second approval window lapsed |
| `needs_reauth` | The wallet session ended; sign in again |

Because results no longer come back in the same call, your agent has to check the status itself. A simple request/response agent cannot wait for the approval, so the examples instruct it to end its turn after a write tool ("approve it in your wallet, then ask me for its status") and call `check_signing_status` on the next user message. An agent loop that can wait may poll instead. See the system prompt in the examples. When `walletVerifiable` is `false` (contract calls, file operations) the wallet cannot fully display the transaction, so show the tool's `summary` to the user before they approve.

Other wallet tools: `wallet_status` (connected account, network, session expiry) and `sign_with_wallet` (raw transaction bytes, rarely needed).

**Limitations**: testnet only; single-key accounts only (no threshold/key-list accounts); no spend policies (the wallet prompt is the spending control).

**Using it from an AI client** (Claude, Cursor, VS Code, Codex CLI, ...): add the URL as a remote MCP server and authenticate. For example `claude mcp add --transport http hedera-testnet https://agentic-testnet-mcp.hedera.com/mcp`, then `/mcp` → Authenticate. See the [Hedera docs](https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-ai-agent-kit/hedera-network-mcp) for each client.
