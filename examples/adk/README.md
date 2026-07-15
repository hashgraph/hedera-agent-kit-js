# Hedera Agent Kit – Google ADK Examples

This directory contains examples of using the **Hedera Agent Kit** with [Google's Agent Development Kit (ADK)](https://google.github.io/adk-docs/get-started/).

For more developer-oriented examples and deeper explanations, see the [Developer Examples documentation](../../docs/DEVEXAMPLES.md).

> [!IMPORTANT]
> **Migrating from v3 to v4?** Check out our [Migration Guide](../../docs/MIGRATION-v4.md).
> 
> **Note on Plugins:** Starting with v4, you must **explicitly pass all plugins** in the configuration. An empty plugin array will no longer result in all default tools being imported. For more details, see [Explicit Plugin Opt-In](https://github.com/hashgraph/hedera-agent-kit-js/blob/feat/release/16.04/docs/MIGRATION-v4.md#4-explicit-plugin-opt-in-behavioral-change).

---

## Prerequisites

- Node.js >= 20
- A [Google AI API Key](https://aistudio.google.com/apikey) (Gemini)
- A Hedera Testnet Account (obtain one from [Hedera Portal](https://portal.hedera.com/))

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file (you can copy `.env.example`):

```bash
cp .env.example .env
```

Add your Hedera credentials and Gemini API key:

```env
ACCOUNT_ID=0.0.xxxxx
PRIVATE_KEY=3030...
GEMINI_API_KEY=your-gemini-api-key
```

> **About Private Keys:** Hedera supports two key types: **ECDSA (secp256k1)** and **ED25519**. These examples default to **ECDSA**. To switch to ED25519, uncomment the appropriate line in the agent's `.ts` file:
> ```ts
> PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)   // default
> // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
> ```
> Both constructors accept hex (`0x...`) and DER-encoded keys. DER-encoded ED25519 keys start with `302e...`; DER-encoded ECDSA keys start with `3030...`. The untyped `PrivateKey.fromString()` is deprecated — use the typed constructors instead. There is no reliable way to infer the key type from the string alone, so pick the constructor matching how the key was generated (the [Hedera Portal](https://portal.hedera.com/) shows the type). A mismatch is rejected by the network with `INVALID_SIGNATURE`. Note: the agent kit's built-in EVM/ERC tools currently require an ECDSA operator key; the Hedera EVM itself supports both key types.
>
> See the Hedera docs on [Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519) and [Accounts and Keys (EVM)](https://docs.hedera.com/evm/differences/accounts-and-keys).

---

## Available Examples

### Plugin Tool Calling Agent

An interactive CLI chatbot that uses plugins for tool discovery and execution on the Hedera network.
> **Note:** It is strongly recommended to use the native ADK tools (`npx adk run agent.ts` and `npx adk web`) for interacting with ADK agents. The custom CLI implemented in `plugin-tool-calling-agent.ts` is provided solely as an example to demonstrate how building a custom CLI runner is possible.

```bash
npm run adk:plugin-tool-calling-agent
```

## Running the ADK CLI Runner

The ADK provides a built-in CLI runner for executing agents.

To run the agent defined in `agent.ts` through the ADK CLI:

```bash
npx adk run agent.ts
```

## Running the ADK Web Interface

The ADK also provides a web-based GUI for building and testing agents interactively.

To start the ADK web interface:

### 2. Define the agent entry point

The ADK web server looks for an `agent.ts` (or `agent.py`) file that exports a `agent` variable. The included `agent.ts` in this directory is already set up this way.

### 3. Start the web server

```bash
npx adk web
```

By default, the interface will be available at `http://localhost:8000`. Open this URL in your browser to start chatting with your Hedera-powered ADK agent!

---

---

## See Also

- **[LangChain Integration (Return-Bytes)](../langchain-v1/external-mcp-return-bytes-agent.ts)**: A similar integration demonstrating how to use LangChain with the "Return-Bytes" MCP mode, including client-side signing logic.

## Reference

- [Google ADK Documentation](https://google.github.io/adk-docs/get-started/)
- [All HAK Developer Examples](../../docs/DEVEXAMPLES.md)
