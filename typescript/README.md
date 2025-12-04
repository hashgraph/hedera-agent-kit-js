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
This version of the Hedera Agent Kit, known as v3, is a complete rewrite of the original version. It is designed to be more flexible and easier to use, with a focus on developer experience. It enables direct API execution through a simple HederaAgentAPI class, with an individual LangChain tools call for each example.

The Hedera Agent Kit is extensible with third party plugins by other projects.

---

## Agent Kit Functionality
The list of currently available Hedera plugins and functionality can be found in the [Plugins & Tools section](#hedera-plugins--tools) of this page

👉 See [docs/PLUGINS.md](../docs/PLUGINS.md) for the full catalogue & usage examples.

Want to add more functionality from Hedera Services? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request)!

---

### Third Party Plugins

- [Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin) provides a streamlined interface to the [**memejob**](https://memejob.fun/) protocol, exposing the core actions (`create`, `buy`, `sell`) for interacting with meme tokens on Hedera:

  Github repository: https://github.com/buidler-labs/hak-memejob-plugin

---
## Developer Examples
You can try out examples of the different types of agents you can build by following the instructions in the [Developer Examples](../docs/DEVEXAMPLES.md) doc in this repo.

First follow instructions in the [Developer Examples to clone and configure the example](../docs/DEVEXAMPLES.md), then choose from one of the examples to run:

* **Option A -** [Example Tool Calling Agent](../docs/DEVEXAMPLES.md#option-a-run-the-example-tool-calling-agent)
* **Option B -** [Example Structured Chat Agent](../docs/DEVEXAMPLES.md#option-b-run-the-structured-chat-agent)
* **Option C -** [Example Return Bytes Agent](../docs/DEVEXAMPLES.md#option-c-try-the-human-in-the-loop-chat-agent)
* **Option D -** [Example MCP Server](../docs/DEVEXAMPLES.md#option-d-try-out-the-mcp-server)
* **Option E -** [Example ElizaOS Agent](../docs/DEVEXAMPLES.md#option-e-try-out-the-hedera-agent-kit-with-elizaos)

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
npm init -y --type=module
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
Create a a new file called `index.js` in the `hello-hedera-agent-kit` folder.

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
This tool has two execution modes with AI agents;  autonomous execution and return bytes. If you set:
 * `mode: AgentMode.RETURN_BYTE` the transaction will be executed, and the bytes to execute the Hedera transaction will be returned. 
 * `mode: AgentMode.AUTONOMOUS` the transaction will be executed autonomously, using the accountID set (the operator account can be set in the client with `.setOperator(process.env.ACCOUNT_ID!`)

### Hedera Plugins & Tools
The Hedera Agent Kit provides a set of tools, bundled into plugins, to interact with the Hedera network. See how to build your own plugins in [docs/HEDERAPLUGINS.md](../docs/HEDERAPLUGINS.md)

Currently, the following plugins are available:

#### Available Plugins & Tools

#### Core Account Plugin: Tools for Hedera Account Service operations
* Transfer HBAR
#### Core Consensus Plugin: Tools for Hedera Consensus Service (HCS) operations 
* Create a Topic
* Submit a message to a Topic 
#### Core HTS Plugin: Tools for Hedera Token Service operations
* Create a Fungible Token
* Create a Non-Fungible Token
* Airdrop Fungible Tokens

#### Core Queries Plugin: Tools for querying Hedera network data
* Get Account Query
* Get HBAR Balance Query
* Get Account Token Balances Query
* Get Topic Messages Query


_See more in [docs/PLUGINS.md](../docs/PLUGINS.md)_

---

## Creating Plugins & Contributing
* You can find a guide for creating plugins in [docs/PLUGINS.md](../docs/PLUGINS.md)

* This guide also has instructions for [publishing and registering your plugin](../docs/PLUGINS.md#publish-and-register-your-plugin) to help our community find and use it.

* If you would like to contribute and suggest improvements for the cord SDK and MCP server, see [CONTRIBUTING.md](../CONTRIBUTING.md) for details on how to contribute to the Hedera Agent Kit.

## License
Apache 2.0

## Credits
Special thanks to the developers of the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) who provided the inspiration for the architecture and patterns used in this project.
