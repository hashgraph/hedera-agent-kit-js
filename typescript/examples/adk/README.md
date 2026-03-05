# Hedera Agent Kit – Google ADK Examples

This directory contains examples of using the **Hedera Agent Kit** with [Google's Agent Development Kit (ADK)](https://google.github.io/adk-docs/get-started/).

For more developer-oriented examples and deeper explanations, see the [Developer Examples documentation](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md).

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

```bash
npm run adk:plugin-tool-calling-agent
```

---

## Running the ADK Web GUI

The ADK provides a built-in web interface for interacting with your agent visually. To launch it:

### 1. Set the `GOOGLE_API_KEY`

The ADK web server reads `GOOGLE_API_KEY` from the environment. Make sure it is set in your `.env` file:

```env
GOOGLE_API_KEY=your-gemini-api-key
```

> **Note:** This can be the same key as `GEMINI_API_KEY`.

### 2. Define the agent entry point

The ADK web server looks for an `agent.ts` (or `agent.py`) file that exports a `agent` variable. The included `agent.ts` in this directory sets up the Hedera agent with all available tools.

### 3. Start the ADK web server

```bash
npx adk web
```

This will start a local web server (by default at `http://localhost:8000`) where you can interact with the Hedera agent through a chat-like UI.

For more details on the ADK web interface and other CLI commands, see the [ADK documentation](https://google.github.io/adk-docs/get-started/).

---

## Reference

- [Google ADK Documentation](https://google.github.io/adk-docs/get-started/)
- [All HAK Developer Examples](../../../docs/DEVEXAMPLES.md)
