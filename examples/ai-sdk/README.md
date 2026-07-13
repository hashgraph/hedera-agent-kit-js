# Hedera Agent Kit - AI SDK Examples

This directory contains simple examples demonstrating how to use the Hedera Agent Kit with Vercel's AI SDK.

> [!IMPORTANT]
> **Migrating from v3 to v4?** Check out our [Migration Guide](../../docs/MIGRATION-v4.md).
> 
> **Note on Plugins:** Starting with v4, you must **explicitly pass all plugins** in the configuration. An empty plugin array will no longer result in all default tools being imported. For more details, see [Explicit Plugin Opt-In](https://github.com/hashgraph/hedera-agent-kit-js/blob/feat/release/16.04/docs/MIGRATION-v4.md#4-explicit-plugin-opt-in-behavioral-change).

## Features

- **AI SDK v6 Support**: Fully compatible with the latest stable version of the AI SDK (`ai` v6).
- **Tool Calling**: Demonstrates how to use Hedera tools with LLMs.

## Prerequisites

- Node.js >= 18
- An OpenAI API Key
- A Hedera Testnet Account

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create a `.env` file (you can copy `.env.example`).
   ```env
   ACCOUNT_ID=0.0.xxxxx
   PRIVATE_KEY=302...
   OPENAI_API_KEY=sk-...
   ```
   > **About Private Keys:** Hedera supports two key types: **ECDSA (secp256k1)** and **ED25519**. These examples default to **ECDSA**. To switch to ED25519, uncomment the appropriate line in the agent's `.ts` file:
   > ```ts
   > PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)   // default
   > // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
   > ```
   > Both constructors accept hex (`0x...`) and DER (`302e...`) encoded keys. The untyped `PrivateKey.fromString()` is deprecated — use the typed constructors instead. There is no reliable way to infer the key type from the string alone, so pick the constructor matching how the key was generated (the Hedera Portal shows the type). A mismatch is rejected by the network with `INVALID_SIGNATURE`. Note: the agent kit's built-in EVM/ERC tools currently require an ECDSA operator key; the Hedera EVM itself supports both key types.
   >
   > See the Hedera docs on [Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519) and [Accounts and Keys (EVM)](https://docs.hedera.com/evm/differences/accounts-and-keys).

## Usage

You can run the examples using the npm scripts defined in `package.json`.

### Basic Tool Calling Agent
Interacts with the Hedera network using standard tools.

```bash
npm run ai-sdk:tool-calling-agent
```

### Plugin Tool Calling Agent
Demonstrates how to use custom plugins.

```bash
npm run ai-sdk:plugin-tool-calling-agent
```

### External MCP Agent
Connects to an external MCP server to perform actions.

```bash
npm run ai-sdk:mcp-external-agent
```

### Preconfigured MCP Agent
Connects to a preconfigured MCP server (like Hederion) to perform actions.

```bash
npm run ai-sdk:preconfigured-mcp-client-agent
```

### Audit Trail Agent
Demonstrates how to use the `HcsAuditTrailHook` to audit HBAR transfers and token creation.

```bash
npm run ai-sdk:audit-trail-agent
```

> [!IMPORTANT]
> This agent works only in `mode: AgentMode.AUTONOMOUS`.

### Policy Enforcement Agent
Demonstrates how to use the `MaxRecipientsPolicy` to restrict transfers.

```bash
npm run ai-sdk:policy-enforcement-agent
```
