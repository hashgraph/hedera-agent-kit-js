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

### 2 – Configure

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
> Create similar .env files for each of the other framework examples

### 3 – Choose an Example
Try out one or more the example agents:

* **Option A -** [Example Tool Calling Agent](#option-a-example-tool-calling-agent)
* **Option B -** [Example Structured Chat Agent](#option-b-example-structured-chat-agent)
* **Option C -** [Example Return Bytes Agent](#option-c-example-return-bytes-agent)
* **Option D -** [Example MCP Server](#option-d-example-mcp-server)
* **Option E -** [Example ElizaOS Agent](#option-e-example-elizaos-agent)

<!-- OR
Try out the create-hedera-app CLI tool to create a new Hedera Agent and a front end applications -->

### Option A: Run the Example Tool Calling Agent 
With the tool-calling-agent (found at `typescript/examples/langchain/tool-calling-agent.ts`), you can experiment with and call the [available tools](docs/TOOLS.md) in the Hedera Agent Kit for the operator account (the account you are using in the .env file). This example tool-calling-agent uses GPT 4-o-mini that is a simple template you can use with other LLMs. This agent is intended for use with simple tasks, such as an invididual tool call.


1. First, go into the directory where the example is and run `npm install`

```bash
cd typescript/examples/langchain
npm install
```
2. Then, run the example

```bash
npm run langchain:tool-calling-agent
```

3. interact with the agent. First, tell the agent who you are (your name) and try out some of the interactions by asking questions: 
  *  _What can you help me do with Hedera?_ 
  * _What's my current HBAR balance?_ 
  * _Create a new topic called 'Daily Updates_ 
  * _Submit the message 'Hello World' to topic 0.0.12345_ 
  * _Create a fungible token called 'MyToken' with symbol 'MTK'_ 
  * _Check my balance and then create a topic for announcements_ 
  * _Create a token with 1000 initial supply and then submit a message about it to topic 0.0.67890_ 
  

### Option B: Run the Structured Chat Agent 
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

### Option C: Try the Human in the Loop Chat Agent
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


### Option D: Try Out the MCP Server
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
  - `--ledger-id=testnet|mainnet` (defaults to testnet)s
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


### Option E: Try out the Hedera Agent Kit with ElizaOS

ElizaOS is a powerful framework for building autonomous AI agents. The Hedera plugin for ElizaOS enables seamless integration with Hedera's blockchain services, allowing you to create sophisticated AI agents that can interact with the Hedera network.

> ⚠️ **Development Status**: The ElizaOS plugin is currently in active development. Features and APIs may change as the plugin evolves.

1. Clone the [Hedera ElizaOS Plugin Repository](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)
2. Install ElizaOS CLI
3. Follow the [Hedera ElizaOS Plugin Docs](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)
