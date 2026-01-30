# Hedera Agent Kit - AI SDK Examples

This directory contains simple examples demonstrating how to use the Hedera Agent Kit with Vercel's AI SDK.

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
   > **Note:** We recommend using a **DER encoded** Private Key (ECDSA or ED_25519) for the Hedera account. You can obtain testnet keys from [Hedera Portal](https://portal.hedera.com/).

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
