# Hedera Agent Kit

![npm version](https://badgen.net/npm/v/hedera-agent-kit)
![license](https://badgen.net/github/license/hedera-dev/hedera-agent-kit)
![build](https://badgen.net/github/checks/hedera-dev/hedera-agent-kit)

> Build Hedera-powered AI agents **in under a minute**.



## 📋 Contents

- [Key Features](#key-features)
- [About the Agent Kit Tools](#about-the-agent-kit-tools)
- [🚀 60-Second Quick-Start](#-60-second-quick-start)
- [📦 Clone & Test the SDK Examples](#-clone--test-the-sdk-examples)
- [Agent Execution Modes](#agent-execution-modes)
- [Hedera Transaction Tools](#hedera-transaction-tools)
- [Hedera Mirror Node Query Tools](#hedera-mirror-node-query-tools)
- [Creating Tools](#creating-tools)
- [License](#license)
- [Credits](#credits)   

---
## Key Features
This version of the Hedera Agent Kit, known as v3, is a complete rewrite of the original version. It is designed to be more flexible and easier to use, with a focus on developer experience. It enables direct API execution through a simple HederaAgentAPI class, with an individual LangChain tools call for each example.

---

## About the Agent Kit Tools
The list of currently available tools can be found in the [Tools section](#hedera-transaction-tools) of this page

👉 See [docs/TOOLS.md](docs/TOOLS.md) for the full catalogue & usage examples.

Want to add more functionality from Hedera Services? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request)!


---

## 🚀 60-Second Quick-Start
See more info at [https://www.npmjs.com/package/hedera-agent-kit](https://www.npmjs.com/package/hedera-agent-kit)

### 🆓 Free AI Options Available!
- **Ollama**: 100% free, runs on your computer, no API key needed
- **Groq**: Offers generous free tier with API key
- **Claude & OpenAI**: Paid options for production use

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
    return new ChatGroq({ model: 'llama3-8b-8192' });
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
      plugins: [coreQueriesPlugin] // all our core plugins here https://github.com/hedera-dev/hedera-agent-kit/tree/main/typescript/src/plugins
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

## 📦 Clone & Test the SDK Examples
### 1 – Install
```bash
git clone https://github.com/hedera-dev/hedera-agent-kit.git 
```

**Requirements** 
- Node.js v20 or higher

**Repo Dependencies**
* Hedera [Hashgraph SDK](https://github.com/hiero-ledger/hiero-sdk-js) and API
* [Langchain Tools](https://js.langchain.com/docs/concepts/tools/) 
* zod 
* dotenv

### 2 – Configure: Add Environment Variables

#### For Agent Examples
Copy `typescript/examples/langchain/.env.example` to `typescript/examples/langchain/.env`:

```bash
cd typescript/examples/langchain
cp .env.example .env
```

Add in your [Hedera API](https://portal.hedera.com/dashboard) and [OPENAPI](https://platform.openai.com/api-keys) Keys

```env
ACCOUNT_ID= 0.0.xxxxx
PRIVATE_KEY= 302e...
OPENAI_API_KEY= sk-proj-...
```
> Note: Running from Source - If you would like to use features of the hedera agent kit that are in this repository, but not yet published to npm, within the `package-lock.json` file in the `/examples/langchain` or `/examples/ai-sdk` directories, change the line that says `"hedera-agent-kit":vx.x.x` to `"hedera-agent-kit": "../.."`. You will also need to go to the root directory of this repository and run `npm install`.

### 3 – Option A: Run the Example Plugin Tool Calling Agent 

With the tool-calling-agent (found at `typescript/examples/langchain/plugin-tool-calling-agent.ts`), you can experiment with and call the [available plugins and tools](docs/PLUGINS.md) in the Hedera Agent Kit for the operator account (the account you are using in the .env file). This example tool-calling-agent uses the LLM you have configured in the .env file. This agent is intended for use with simple tasks, such as an invididual tool call.

1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```
2. Then, run the example

```bash
npm run langchain:plugin-tool-calling-agent
```

3. interact with the agent. First, tell the agent who you are (your name) and try out some of the interactions by asking questions: 
  *  _What can you help me do with Hedera?_ 
  * _What's my current HBAR balance?_ 
  * _Create a new topic called 'Daily Updates'_ 
  * _Submit the message 'Hello World' to topic 0.0.12345_ 
  * _Create a fungible token called 'MyToken' with symbol 'MTK'_ 
  * _Check my hbar balance_
  * _Create a token with 1000 initial supply and then submit a message about it to topic 0.0.67890_ 
  

### 4 – Option B: Run the Structured Chat Agent 
The structured chat agent enables you to interact with the Hedera blockchain in the same way as the tool calling agent, using GPT-4.1 as the LLM. You can use tools in autonomous mode using pre-built [prompts from the LangChain Hub](https://github.com/hwchase17/langchain-hub/blob/master/prompts/README.md).


1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```
2. Then, run the example

```bash
npm run langchain:structured-chat-agent
```

### 5 - Option C: Try the Human in the Loop Chat Agent
The Human in the Loop Chat Agent enables you to interact with the Hedera blockchain in the same way as the tool calling agent, using GPT-4.1 as the LLM, except uses the RETURN_BYTES execution mode, instead of AgentMode.AUTONOMOUS. 

This agent will create the transaction requested in natural language, and return the bytes the user to execute the transaction in another tool.

1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```
2. Then, run the 'human in the loop' or 'return bytes' example:

```bash
npm run langchain:return-bytes-tool-calling-agent
```
The agent will start a CLI chatbot that you can interact with. You can make requests in natural language, and this demo will demonstrate an app with a workflow that requires a human in the loop to approve actions and execute transactions.

You can modify the `typescript/examples/langchain/return-bytes-tool-calling-agent.ts` file to add define the available tools you would like to use with this agent:

```javascript
const {
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_TOPIC_TOOL,
    SUBMIT_TOPIC_MESSAGE_TOOL,
    GET_HBAR_BALANCE_QUERY_TOOL,
    TRANSFER_HBAR_TOOL,
    // CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    // AIRDROP_FUNGIBLE_TOKEN_TOOL,
    // GET_ACCOUNT_QUERY_TOOL,
    // GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    // GET_TOPIC_MESSAGES_QUERY_TOOL,
  } = hederaTools;
``` 

And then add the tools to the toolkit:
```javascript
const hederaAgentToolkit = new HederaLangchainToolkit({
    client: agentClient,
    configuration: {
      tools: [
        CREATE_TOPIC_TOOL,
        SUBMIT_TOPIC_MESSAGE_TOOL,
        CREATE_FUNGIBLE_TOKEN_TOOL,
        GET_HBAR_BALANCE_QUERY_TOOL,
        TRANSFER_HBAR_TOOL, 
      ], // use an empty array if you wantto load all tools
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
      },
    },
  });
``` 

<!-- 3. Use the bytes to execute the transaction in another tool.

This feature is useful if you would like to create an application, say a chatbot, which can support a back and fourth where the user makes a request, and is prompted to approve the request before the transaction is carried out, and perhaps uses a tool like the [Hashpack Wallet](https://docs.hashpack.app/) to execute.

In this example, we can just take the returned bytes and execute the transaction in the Hashpack Wallet -->


### 6 - Option D: Try Out the MCP Server
1. First, navigate into the folder for the agent kit mcp server.

```bash
cd modelcontextprotocol
```

2. Export two environment variables, one for your Hedera testnet account, and one for your DER-encoded private key. You can also create an `.env` file in the `modelcontextprotocol` directory to store these variables.

```bash
export HEDERA_OPERATOR_ID="0.0.xxxxx"
export HEDERA_OPERATOR_KEY="0x2g3..."
```

 2. Build and Run the MCP Server. From the `modelcontextprotocol` directory, install dependencies and build:

```bash
npm install
npm run build
```
3. Run and test the MCP server.
The server accepts these command-line options:
  - `--ledger-id=testnet|mainnet` (defaults to testnet/ mainnet)
  - `--agent-mode`, and `--account-id` for additional configuration

4. Run the server to verify it works:

```bash
node dist/index.js
```


**Optional: Test out Claude Desktop or an IDE to operate the Hedera MCP server.**

5. Create/edit Claude Desktop or your IDE MCP config file:
```json
{
"mcpServers": {
  "hedera-mcp-server": {
        "command": "node",
        "args": [
          "<Path>/hedera-agent-kit/modelcontextprotocol/dist/index.js"
        ],
        "env": {
          "HEDERA_OPERATOR_ID": "0.0.xxxx",
          "HEDERA_OPERATOR_KEY": "302e...."
        }
      }
  }
}
```

### 7 - Option E: Try out the Hedera Agent Kit with ElizaOS

ElizaOS is a powerful framework for building autonomous AI agents. The Hedera plugin for ElizaOS enables seamless integration with Hedera's blockchain services, allowing you to create sophisticated AI agents that can interact with the Hedera network.

> ⚠️ **Development Status**: The ElizaOS plugin is currently in active development. Features and APIs may change as the plugin evolves.

1. Clone the [Hedera ElizaOS Plugin Repository](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)
2. Install ElizaOS CLI
3. Follow the [Hedera ElizaOS Plugin Docs](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)


## About the Agent Kit

### Agent Execution Modes
This tool has two execution modes with AI agents;  autonomous excution and return bytes. If you set:
 * `mode: AgentMode.RETURN_BYTE` the transaction will be executed, and the bytes to execute the Hedera transaction will be returned. 
 * `mode: AgentMode.AUTONOMOUS` the transaction will be executed autonomously, using the accountID set (the operator account can be set in the client with `.setOperator(process.env.ACCOUNT_ID!`)

### Hedera Plugins & Tools
The Hedera Agent Kit provides a set of tools, bundled into plugins, to interact with the Hedera network. See how to build your own plugins in [docs/HEDERAPLUGINS.md](docs/HEDERAPLUGINS.md)

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

To request more functionality in the toolkit for other Hedera services, please [open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request).

See a more thorough description and how to implement the plugins in [docs/HEDERAPLUGINS.md](docs/HEDERAPLUGINS.md)

---

### Third Party Plugins

- [Memejob Plugin](https://www.npmjs.com/package/@buidlerlabs/hak-memejob-plugin) provides a streamlined interface to the [**memejob**](https://memejob.fun/) protocol, exposing the core actions (`create`, `buy`, `sell`) for interacting with meme tokens on Hedera:

  Github repository: https://github.com/buidler-labs/hak-memejob-plugin

---

## Creating Plugins & Contributing
* You can find a guide for creating plugins in [docs/HEDERAPLUGINS.md](docs/HEDERAPLUGINS.md)

* If you would like to contribute and suggest improvements for the cord SDK and MCP server, see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the Hedera Agent Kit.

## License
Apache 2.0

## Credits
Special thanks to the developers of the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) who provided the inspiration for the architecture and patterns used in this project.
