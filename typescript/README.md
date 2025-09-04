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

👉 See [docs/PLUGINS.md](docs/PLUGINS.md) for the full catalogue & usage examples.

Want to add more functionality from Hedera Services? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request)!

---

### Third Party Plugins

- [Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin) provides a streamlined interface to the [**memejob**](https://memejob.fun/) protocol, exposing the core actions (`create`, `buy`, `sell`) for interacting with meme tokens on Hedera:

  Github repository: https://github.com/buidler-labs/hak-memejob-plugin

---
## Developer Examples
You can try out examples of the different types of agents you can build by followin the instructions in the [Developer Examples](..docs/DEVEXAMPLES.md) doc in this repo.

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
npm init -y
```

> This command initializes a CommonJS project by default.

```bash
npm install hedera-agent-kit @langchain/core langchain @hashgraph/sdk dotenv
```

Then install ONE of these AI provider packages:
```bash
# Option 1: OpenAI (requires API key)
npm install @langchain/openai

# Option 2: Anthropic Claude (requires API key)
npm install @langchain/anthropic

# Option 3: Groq (free tier available)
npm install @langchain/groq

# Option 4: Ollama (100% free, runs locally)
npm install @langchain/ollama
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
HEDERA_ACCOUNT_ID="0.0.xxxxx"
HEDERA_PRIVATE_KEY="0x..." # ECDSA encoded private key

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
const dotenv = require('dotenv');
dotenv.config();

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { 
  HederaLangchainToolkit,AgentMode, coreQueriesPlugin,coreAccountPlugin, coreConsensusPlugin, coreTokenPlugin 
} from 'hedera-agent-kit';
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { AgentExecutor, createToolCallingAgent } = require('langchain/agents');
const { Client, PrivateKey } = require('@hashgraph/sdk');
const { HederaLangchainToolkit, coreQueriesPlugin } = require('hedera-agent-kit');

// Choose your AI provider (install the one you want to use)
function createLLM() {
  // Option 1: OpenAI (requires OPENAI_API_KEY in .env)
  if (process.env.OPENAI_API_KEY) {
    const { ChatOpenAI } = require('@langchain/openai');
    return new ChatOpenAI({ model: 'gpt-4o-mini' });
  }
  
  // Option 2: Anthropic Claude (requires ANTHROPIC_API_KEY in .env)
  if (process.env.ANTHROPIC_API_KEY) {
    const { ChatAnthropic } = require('@langchain/anthropic');
    return new ChatAnthropic({ model: 'claude-3-haiku-20240307' });
  }
  
  // Option 3: Groq (requires GROQ_API_KEY in .env)
  if (process.env.GROQ_API_KEY) {
    const { ChatGroq } = require('@langchain/groq');
    return new ChatGroq({ model: 'llama-3.3-70b-versatile' });
  }
  
  // Option 4: Ollama (free, local - requires Ollama installed and running)
  try {
    const { ChatOllama } = require('@langchain/ollama');
    return new ChatOllama({ 
      model: 'llama3.2',
      baseUrl: 'http://localhost:11434'
    });
  } catch (e) {
    console.error('No AI provider configured. Please either:');
    console.error('1. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY in .env');
    console.error('2. Install and run Ollama locally (https://ollama.com)');
    process.exit(1);
  }
}

async function main() {
  // Initialize AI model
  const llm = createLLM();

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.HEDERA_ACCOUNT_ID,
    PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY),
  );

  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [], // use an empty array to load all tools from plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
      plugins: [
        coreQueriesPlugin,    // For account queries and balances
        coreAccountPlugin,    // For HBAR transfers
        coreConsensusPlugin,  // For HCS topics and messages
        coreTokenPlugin,        // For token operations
      ], // use an empty array to load all core plugins
    },
  });
  
  // Load the structured chat prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Fetch tools from toolkit
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });
  
  // Wrap everything in an executor that will maintain memory
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  
  const response = await agentExecutor.invoke({ input: "what's my balance?" });
  console.log(response);
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
... 
//original
  const response = await agentExecutor.invoke({ input: "what's my balance?" });
// or
  const response = await agentExecutor.invoke({ input: "create a new token called 'TestToken' with symbol 'TEST'" });
// or
  const response = await agentExecutor.invoke({ input: "transfer 5 HBAR to account 0.0.1234" });
// or
  const response = await agentExecutor.invoke({ input: "create a new topic for project updates" });
...
   console.log(response);
```
> To get other Hedera Agent Kit tools working, take a look at the example agent implementations at [https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain](https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/examples/langchain)

---

## About the Agent Kit

### Agent Execution Modes
This tool has two execution modes with AI agents;  autonomous excution and return bytes. If you set:
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

* If you would like to contribute and suggest improvements for the cord SDK and MCP server, see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the Hedera Agent Kit.

## License
Apache 2.0

## Credits
Special thanks to the developers of the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) who provided the inspiration for the architecture and patterns used in this project.
