# Hedera Agent Kit

![npm version](https://badgen.net/npm/v/hedera-agent-kit)
![license](https://badgen.net/github/license/hedera-dev/hedera-agent-kit)
![build](https://badgen.net/github/checks/hedera-dev/hedera-agent-kit)

> Build Hedera-powered AI agents **in under a minute**.

## 📋 Contents

- [Key Features](#key-features)
- [About the Agent Kit Functionality](#agent-kit-functionality)
- [Third Party Plugins](#third-party-plugins)
- [Developer Examples](#developer-examples)
- [🚀 60-Second Quick-Start](#-60-second-quick-start)
- [Agent Execution Modes](#agent-execution-modes)
- [Hedera Plugins & Tools](#hedera-plugins--tools)
- [Creating Plugins & Contributing](#creating-plugins--contributing)
- [License](#license)
- [Credits](#credits)

---

## Key Features

The Hedera Agent Kit is an open-source toolkit that brings intelligent agent workflows to the Hedera network. It’s designed for developers who want to integrate Hedera account management and Hedera native functionality into agent applications. With the Hedera Agent Kit, developers can build agents that interact on-chain through a conversational interface. This means Hedera agents can do more than process information; they can also send tokens, manage accounts, store data on Hedera Consensus Service, and coordinate workflows directly on a public ledger.

This version of the Hedera Agent Kit, known as v3, is a complete rewrite of the original version. It is designed to be more flexible and easier to use, with a focus on developer experience. It enables direct API execution through a simple HederaAgentAPI class, with an individual LangChain tools call for each example. [Learn more about Hedera Agent Kit V3](https://hedera.com/blog/whats-new-in-ai-studio/)

The Hedera Agent Kit is extensible with third party plugins by other projects.

---

## Agent Kit Functionality

The list of currently available Hedera plugins and functionality can be found in the [Hedera Plugins & Tools](#hedera-plugins--tools) and [Third Party Plugins](#third-party-plugins) sections of this page

👉 See [docs/HEDERAPLUGINS.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/HEDERAPLUGINS.md) for the full catalogue & usage examples for Hedera Tools.

Want to add more functionality from Hedera Services? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request)!

---

### Third Party Plugins

The Hedera Agent Kit is extensible with third party plugins by other projects. See how you can build and submit your own plugin to be listed as a Hedera Agent Kit plugin in [Hedera Docs](https://docs.hedera.com/hedera/open-source-solutions/ai-studio-on-hedera/hedera-ai-agent-kit/hedera-agent-kit-js/plugins) and [docs/PLUGINS.md](./docs/PLUGINS.md).

#### DeFi & Trading

- **[Official SaucerSwap Plugin](https://www.npmjs.com/package/saucer-swap-plugin)** – Streamlined interface to the [SaucerSwap](https://saucerswap.finance) DEX, exposing V2 protocol actions (`get_swap_quote_v2_tool`, `swap_v2_tool`).
  - **NPM:** [saucer-swap-plugin](https://www.npmjs.com/package/saucer-swap-plugin)
  - **GitHub:** _To be added_
  - **Endorsed version:** `saucer-swap-plugin@0.1.0`

- **[SaucerSwap Plugin](https://www.npmjs.com/package/hak-saucerswap-plugin)** – Community interface to [SaucerSwap](https://saucerswap.finance) with comprehensive actions for swaps, liquidity, and farming (`saucerswap_get_swap_quote`, `saucerswap_swap_tokens`, `saucerswap_get_pools`, `saucerswap_add_liquidity`, `saucerswap_remove_liquidity`, `saucerswap_get_farms`).
  - **NPM:** [hak-saucerswap-plugin](https://www.npmjs.com/package/hak-saucerswap-plugin)
  - **GitHub:** [jmgomezl/hak-saucerswap-plugin](https://github.com/jmgomezl/hak-saucerswap-plugin)
  - **Endorsed version:** `hak-saucerswap-plugin@1.0.1`

- **[Bonzo Plugin](https://www.npmjs.com/package/@bonzofinancelabs/hak-bonzo-plugin)** – Unified SDK for the [Bonzo Finance](https://bonzo.finance) protocol, enabling decentralized lending and borrowing (`deposit`, `withdraw`, `repay`, `borrow`).
  - **NPM:** [@bonzofinancelabs/hak-bonzo-plugin](https://www.npmjs.com/package/@bonzofinancelabs/hak-bonzo-plugin)
  - **GitHub:** [Bonzo-Labs/bonzoPlugin](https://github.com/Bonzo-Labs/bonzoPlugin)

- **[Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin)** – Interface to the [memejob](https://memejob.fun/) protocol for meme token interactions (`create`, `buy`, `sell`).
  - **NPM:** [@buidlerlabs/hak-memejob-plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin)
  - **GitHub:** [buidler-labs/hak-memejob-plugin](https://github.com/buidler-labs/hak-memejob-plugin)

#### Price Feeds & Market Data

- **[Pyth Plugin](https://www.npmjs.com/package/hak-pyth-plugin)** – Access [Pyth Network](https://www.pyth.network/) price feeds via the Hermes API, with tools to list feeds and fetch latest prices.
  - **NPM:** [hak-pyth-plugin](https://www.npmjs.com/package/hak-pyth-plugin)
  - **GitHub:** [jmgomezl/hak-pyth-plugin](https://github.com/jmgomezl/hak-pyth-plugin)
  - **Endorsed version:** `hak-pyth-plugin@0.1.1`

- **[Chainlink Price Feed Plugin](https://www.npmjs.com/package/chainlink-pricefeed-plugin)** – Access [Chainlink](https://docs.chain.link/data-feeds/price-feeds) price feeds for aggregated data from multiple sources (`get price feed` for ETH, BTC, HBAR, LINK, USDC, UST, DAI).
  - **NPM:** [chainlink-pricefeed-plugin](https://www.npmjs.com/package/chainlink-pricefeed-plugin)
  - **GitHub:** [henrytongv/chainlink-price-plugin-js](https://github.com/henrytongv/chainlink-price-plugin-js)
  - **Endorsed version:** `chainlink-pricefeed-plugin@1.0.4`

- **[CoinCap Plugin](https://www.npmjs.com/package/coincap-hedera-plugin)** – Access [CoinCap API](https://www.coincap.io) for cryptocurrency market data, including HBAR price in USD (`get HBAR price in USD`).
  - **NPM:** [coincap-hedera-plugin](https://www.npmjs.com/package/coincap-hedera-plugin)
  - **GitHub:** [henrytongv/coincap-hedera-plugin](https://github.com/henrytongv/coincap-hedera-plugin)
  - **Endorsed version:** `coincap-hedera-plugin@1.0.4`

_[Contribute your own plugin](./docs/PLUGINS.md)_
---

## Developer Examples

You can try out examples of the different types of agents you can build by followin the instructions in the [Developer Examples](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md) doc in this repo.

First follow instructions in the [Developer Examples to clone and configure the example](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md), then choose from one of the examples to run:

- **Option A -** [Example Tool Calling Agent](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md#option-a-run-the-example-tool-calling-agent)
- **Option B -** [Example Structured Chat Agent](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md#option-b-run-the-structured-chat-agent)
- **Option C -** [Example Return Bytes Agent](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md#option-c-try-the-human-in-the-loop-chat-agent)
- **Option D -** [Example MCP Server](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md#option-d-try-out-the-mcp-server)
- **Option E -** [Example ElizaOS Agent](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md#option-e-try-out-the-hedera-agent-kit-with-elizaos)

---

## 🚀 60-Second Quick-Start

See more info at [https://www.npmjs.com/package/hedera-agent-kit](https://www.npmjs.com/package/hedera-agent-kit)

### 🆓 Free AI Options Available!

- **Ollama**: 100% free, runs on your computer, no API key needed
- **[Groq](https://console.groq.com/keys)**: Offers generous free tier with API key
- **[Claude](https://console.anthropic.com/settings/keys) & [OpenAI](https://platform.openai.com/api-keys)**: Paid options for production use

### 1 – Project Setup
Create a directory for your project and install dependencies:
```bash
mkdir hello-hedera-agent-kit
cd hello-hedera-agent-kit
```

Init and install with npm
```bash
npm init -y
```

Open `package.json` and add `"type": "module"` to enable ES modules.

```bash
npm install hedera-agent-kit @langchain/core langchain @langchain/langgraph @langchain/openai @hashgraph/sdk dotenv
```

### 2 – Configure: Add Environment Variables

Create an `.env` file in the root directory of your project:

```bash
touch .env
```

If you already have a **testnet** account, you can use it. Otherwise, you can create a new one at [https://portal.hedera.com/dashboard](https://portal.hedera.com/dashboard)

Add the following to the .env file:

```env
# Required: Hedera credentials (get free testnet account at https://portal.hedera.com/dashboard)
ACCOUNT_ID="0.0.xxxxx"
PRIVATE_KEY="0x..." # ECDSA encoded private key

# Optional: Add the API key for your chosen AI provider
OPENAI_API_KEY="sk-proj-..."      # For OpenAI (https://platform.openai.com/api-keys)
ANTHROPIC_API_KEY="sk-ant-..."    # For Claude (https://console.anthropic.com)
GROQ_API_KEY="gsk_..."            # For Groq free tier (https://console.groq.com/keys)
# Ollama doesn't need an API key (runs locally)
```

### 3 – Simple "Hello Hedera Agent Kit" Example

Create a new file called `index.js` in the `hello-hedera-agent-kit` folder.

```bash
touch index.js
```

Once you have created a new file `index.js` and added the environment variables, you can run the following code:

```javascript
// index.js
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode } from 'hedera-agent-kit';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY)
  );

  // Prepare Hedera toolkit
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [], // Add specific tools here if needed, or leave empty for defaults/plugins
      plugins: [], // Add plugins here
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  // Fetch tools from a toolkit
  const tools = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt: 'You are a helpful assistant with access to Hedera blockchain tools',
    checkpointer: new MemorySaver(),
  });

  console.log('Sending a message to the agent...');
  
  const response = await agent.invoke(
    { messages: [{ role: 'user', content: "what's my balance?" }] },
    { configurable: { thread_id: '1' } }
  );

  console.log(response.messages[response.messages.length - 1].content);
}

main().catch(console.error);
```

### 4 – Run Your "Hello Hedera Agent Kit" Example

From the root directory, run your example agent, and prompt it to give your hbar balance:

```bash
node index.js
```

If you would like, try adding in other prompts to the agent to see what it can do.

```javascript
// ...
//original
  const response = await agent.invoke(
    { messages: [{ role: 'user', content: "what's my balance?" }] },
    { configurable: { thread_id: '1' } }
  );
// or
  const response = await agent.invoke(
    { messages: [{ role: 'user', content: "create a new token called 'TestToken' with symbol 'TEST'" }] },
    { configurable: { thread_id: '1' } }
  );
// or
  const response = await agent.invoke(
    { messages: [{ role: 'user', content: "transfer 5 HBAR to account 0.0.1234" }] },
    { configurable: { thread_id: '1' } }
  );
// or
  const response = await agent.invoke(
    { messages: [{ role: 'user', content: "create a new topic for project updates" }] },
    { configurable: { thread_id: '1' } }
  );
// ...
   console.log(response.messages[response.messages.length - 1].content);
```

> To get other Hedera Agent Kit tools working, take a look at the example agent implementations at [https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain](https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain)

---

## About the Agent Kit

### Agent Execution Modes

This tool has two execution modes with AI agents; autonomous execution and return bytes. If you set:

- `mode: AgentMode.RETURN_BYTE` the transaction will be executed, and the bytes to execute the Hedera transaction will be returned.
- `mode: AgentMode.AUTONOMOUS` the transaction will be executed autonomously, using the accountID set (the operator account can be set in the client with `.setOperator(process.env.ACCOUNT_ID!`)

### Hedera Plugins & Tools

The Hedera Agent Kit provides a set of tools, bundled into plugins, to interact with the Hedera network. See how to build your own plugins in [docs/HEDERAPLUGINS.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/HEDERAPLUGINS.md)

Currently, the following plugins are available:

#### Available Plugins & Tools

#### Core Account Plugin: Tools for Hedera Account Service operations

- Transfer HBAR

#### Core Consensus Plugin: Tools for Hedera Consensus Service (HCS) operations

- Create a Topic
- Submit a message to a Topic

#### Core HTS Plugin: Tools for Hedera Token Service operations

- Create a Fungible Token
- Create a Non-Fungible Token
- Airdrop Fungible Tokens

#### Core Queries Plugin: Tools for querying Hedera network data

- Get Account Query
- Get HBAR Balance Query
- Get Account Token Balances Query
- Get Topic Messages Query

_See more in [docs/PLUGINS.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/PLUGINS.md)_

---

## Creating Plugins & Contributing

- You can find a guide for creating plugins in [docs/PLUGINS.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/PLUGINS.md)

- This guide also has instructions for [publishing and registering your plugin](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/PLUGINS.md#publish-and-register-your-plugin) to help our community find and use it.

- If you would like to contribute and suggest improvements for the cord SDK and MCP server, see [CONTRIBUTING.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/CONTRIBUTING.md) for details on how to contribute to the Hedera Agent Kit.

## License

Apache 2.0

## Credits

Special thanks to the developers of the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) who provided the inspiration for the architecture and patterns used in this project.
