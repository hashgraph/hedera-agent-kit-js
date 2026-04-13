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
PRIVATE_KEY=302e...
GEMINI_API_KEY=your-gemini-api-key
```

> **Note:** We recommend using a **DER-encoded** Private Key (ECDSA or ED25519) for the Hedera account. You can obtain testnet keys from [Hedera Portal](https://portal.hedera.com/).

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

## Reference

- [Google ADK Documentation](https://google.github.io/adk-docs/get-started/)
- [All HAK Developer Examples](../../docs/DEVEXAMPLES.md)
