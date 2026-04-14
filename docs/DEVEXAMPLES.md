## 📦 Clone & Test the SDK Examples
### 1 – Install
```bash
git clone https://github.com/hashgraph/hedera-agent-kit-js.git 
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
**LangChain classic**
Copy `examples/langchain/.env.example` to `examples/langchain/.env`:

```bash
cd examples/langchain
cp .env.example .env
```

**LangChain v1**
Copy `examples/langchain-v1/.env.example` to `examples/langchain-v1/.env`:

```bash
cd examples/langchain-v1
cp .env.example .env
```

Add in your [Hedera API](https://portal.hedera.com/dashboard) and [OPENAPI](https://platform.openai.com/api-keys) Keys

```env
ACCOUNT_ID= 0.0.xxxxx
PRIVATE_KEY= 302e...
OPENAI_API_KEY= sk-proj-...
```

##### About Private Keys

Hedera supports both **ECDSA** and **ED25519** private keys. The examples use **ECDSA** by default. To use an **ED25519** key, uncomment the appropriate line in the agent's `.ts` file:

```ts
// PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

For more information about Hedera key types and formats, see the [Hedera documentation on Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).

> Create similar .env files for each of the other framework examples

### 3 – Choose an Example
Try out one or more of the example agents:

* **Option A -** [Example Tool Calling Agent](#option-a-run-the-example-tool-calling-agent)
* **Option B -** [Example Structured Chat Agent](#option-b-run-the-structured-chat-agent-langchain-v03-only)
* **Option C -** [Example Return Bytes Agent](#option-c-try-the-human-in-the-loop-chat-agent)
* **Option D -** [Example MCP Server](#option-d-try-out-the-mcp-server)
* **Option E -** [Example External MCP Agent](#option-e-try-out-the-external-mcp-agent)
* **Option F -** [Example ElizaOS Agent](#option-f-try-out-the-hedera-agent-kit-with-elizaos)
* **Option G -** [Example Preconfigured MCP Client Agent](#option-g-try-out-the-preconfigured-mcp-client-agent)
* **Option H -** [Example Policy Enforcement Agent](#option-h-run-the-policy-enforcement-agent)
* **Option I -** [Example Audit Trail Agent](#option-i-run-the-audit-trail-agent)
* **Option J -** [Example Google ADK Agent](#option-j-try-out-the-google-adk-agent)

<!-- OR
Try out the create-hedera-app CLI tool to create a new Hedera Agent and a front end application -->

### Option A: Run the Example Tool Calling Agent
With the tool-calling-agent you can experiment with and call the [available tools](../docs/HEDERAPLUGINS.md) in the Hedera Agent Kit for the operator account (the account you are using in the .env file). This example tool-calling-agent uses GPT 4-o-mini that is a simple template you can use with other LLMs. This agent is intended for use with simple tasks, such as an individual tool call.

#### LangChain Classic
Found at `examples/langchain/tool-calling-agent.ts`.

1. First, go into the directory where the example is and run `npm install`

```bash
cd examples/langchain
npm install
```
2. Then, run the example

```bash
npm run langchain:tool-calling-agent
```

#### LangChain v1
Found at `examples/langchain-v1/plugin-tool-calling-agent.ts`.

1. First, go into the directory where the example is and run `npm install`

```bash
cd examples/langchain-v1
npm install
```
2. Then, run the example

```bash
npm run langchain:plugin-tool-calling-agent
```

3. interact with the agent. First, tell the agent who you are (your name) and try out some interactions by asking questions: 
  *  _What can you help me do with Hedera?_ 
  * _What's my current HBAR balance?_ 
  * _Create a new topic called 'Daily Updates_ 
  * _Submit the message 'Hello World' to topic 0.0.12345_ 
  * _Create a fungible token called 'MyToken' with symbol 'MTK'_ 
  * _Check my balance and then create a topic for announcements_ 
  * _Create a token with 1000 initial supply and then submit a message about it to topic 0.0.67890_ 
  

### Option B: Run the Structured Chat Agent (LangChain v0.3 only)
The structured chat agent enables you to interact with the Hedera blockchain in the same way as the tool calling agent, using GPT-4.1 as the LLM. You can use tools in autonomous mode using pre-built [prompts from the LangChain Hub](https://github.com/hwchase17/langchain-hub/blob/master/prompts/README.md).


1. First, go into the directory where the example is and run `npm install`

```bash
cd examples/langchain
npm install
```
2. Then, run the example

```bash
npm run langchain:structured-chat-agent
```

### Option C: Try the Human in the Loop Chat Agent
The Human in the Loop Chat Agent enables you to interact with the Hedera blockchain in the same way as the tool calling agent, using GPT-4.1 as the LLM, except uses the RETURN_BYTES execution mode, instead of `AgentMode.AUTONOMOUS`. 

This agent will create the transaction requested in natural language, and return the bytes the user to execute the transaction in another tool.

#### LangChain v0.3

1. First, go into the directory where the example is and run `npm install`

```bash
cd examples/langchain
npm install
```
2. Then, run the 'human in the loop' or 'return bytes' example:

```bash
npm run langchain:return-bytes-tool-calling-agent
```

#### LangChain v1

1. First, go into the directory where the example is and run `npm install`

```bash
cd examples/langchain-v1
npm install
```
2. Then, run the 'human in the loop' or 'return bytes' example:

```bash
npm run langchain:return-bytes-tool-calling-agent
```

**⚠️ Breaking Change: v4.0.0 Migration from Buffer to Uint8Array**

`RETURN_BYTES` now standardizes `raw.bytes` to `Uint8Array` across Node.js and web. If you previously parsed Node-specific Buffer payloads (`{ type: 'Buffer', data: [...] }`), migrate to a `Uint8Array` parser.

Before:

```ts
const realBytes = Buffer.isBuffer(bytesObject)
  ? bytesObject
  : Buffer.from(bytesObject.data);
```

After:

```ts
const bytes = toolCall.parsedData.raw.bytes;
const tx = Transaction.fromBytes(bytes);
```

The agent will start a CLI chatbot that you can interact with. You can make requests in natural language, and this demo will demonstrate an app with a workflow that requires a human in the loop to approve actions and execute transactions.

You can modify the `examples/langchain/return-bytes-tool-calling-agent.ts` file to add define the available tools you would like to use with this agent:

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
1. Navigate to the MCP examples directory:

```bash
cd examples/modelcontextprotocol
```

2. Configure your environment:
Create an `.env` file with `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY`.

3. Install dependencies and build:

```bash
npm install
cd ../../packages/mcp
npm install
npm run build
cd ../../examples/modelcontextprotocol
```

4. Run the Stdio MCP Server:

```bash
npm start:stdio
```

5. Or run the HTTP MCP Server:

```bash
npm start:http
```


**Optional: Test out Claude Desktop or an IDE to operate the Hedera MCP server.**

5. Create/edit Claude Desktop or your IDE MCP config file:
```json
{
"mcpServers": {
  "hedera-mcp-server": {
        "command": "node",
        "args": [
          "<Path>/hedera-agent-kit-js/examples/modelcontextprotocol/dist/stdio.js"
        ],
        "env": {
          "HEDERA_OPERATOR_ID": "0.0.xxxx",
          "HEDERA_OPERATOR_KEY": "302e...."
        }
      }
  }
}
```


### Option E: Try Out the External MCP Agent

This example demonstrates how to integrate external MCP (Model Context Protocol) servers with the Hedera Agent Kit. The agent combines a single plugin from the local toolkit with tools from a remote MCP server. While this example uses the Hedera MCP server from this repository, you can easily integrate other MCP servers by modifying the configuration.

**Found at:**
- `examples/langchain-v1/external-mcp-agent.ts`
- `examples/ai-sdk/mcp-external-agent.ts`


#### Prerequisites

1. Set up the Hedera MCP server following the instructions in [Option D](#option-d-try-out-the-mcp-server).

```bash
cd examples/modelcontextprotocol
npm install
cd ../../packages/mcp
npm install
npm run build
cd ../../examples/modelcontextprotocol
```

2. Configure your environment variables in `examples/langchain-v1/.env`:

```env
ACCOUNT_ID=0.0.xxxxx
PRIVATE_KEY=302e...
OPENAI_API_KEY=sk-proj-...
```

**Note about private keys:** The Hedera Agent Kit supports both **ECDSA** and **ED25519** private keys. The examples use **ECDSA** by default (e.g., `302e...`). If you have an **ED25519** key, uncomment the appropriate line in `external-mcp-agent.ts` to use `PrivateKey.fromStringED25519()` instead. Learn more about [Hedera key types](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).

3. Update the MCP server path in `external-mcp-agent.ts` in the `args` array with the absolute path to your built MCP server.

#### Running the Example

##### LangChain v1

1. Navigate to the example directory:

```bash
cd examples/langchain-v1
npm install
```

2. Run the external MCP agent:

```bash
npm run langchain:external-mcp-agent
```

The agent will start a CLI chatbot that combines the `coreMiscQueriesPlugin` from the local toolkit with tools from the external MCP server, allowing you to interact with the Hedera blockchain in natural language.

##### AI SDK

1. Navigate to the example directory:

```bash
cd examples/ai-sdk
npm install
```

2. Run the external MCP agent:

```bash
npm run ai-sdk:mcp-external-agent
```

The agent will start a CLI chatbot using the AI SDK to interact with the external MCP server.

**Note:** To integrate other types of MCP servers (HTTP, SSE, WebSocket, etc.), modify the `mcpServers` configuration in the example file. See the [LangChain MCP Adapters documentation](https://reference.langchain.com/python/langchain_mcp_adapters/#langchain_mcp_adapters.client) for configuration details.

### Option F: Try out the Hedera Agent Kit with ElizaOS

ElizaOS is a powerful framework for building autonomous AI agents. The Hedera plugin for ElizaOS enables seamless integration with Hedera's blockchain services, allowing you to create sophisticated AI agents that can interact with the Hedera network.

**v4 Import Update**

As of v4, ElizaOS is a standalone package:

```typescript
import { HederaElizaOSToolkit } from '@hashgraph/hedera-agent-kit-elizaos';
```

See the [v3 to v4 Migration Guide](MIGRATION-v4.md) for full details.


1. Clone the [Hedera ElizaOS Plugin Repository](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)
2. Install ElizaOS CLI
3. Follow the [Hedera ElizaOS Plugin Docs](https://github.com/hedera-dev/eliza-plugin-hedera/tree/feat/rework-v3)
### Option G: Try out the Preconfigured MCP Client Agent

This example demonstrates how to use the Hedera Agent Kit with preconfigured MCP servers (like Hederion or Hgraph) to access advanced tools without manual server setup.

**Found at:**
- `examples/langchain-v1/preconfigured-mcp-client-agent.ts`
- `examples/ai-sdk/preconfigured-mcp-client-agent.ts`

#### Prerequisites

1. Configure your environment variables as described in the "Configure" section above.

#### Running the Example

##### LangChain v1

```bash
cd examples/langchain-v1
npm install
npm run langchain:preconfigured-mcp-client-agent
```

##### AI SDK

```bash
cd examples/ai-sdk
npm install
npm run ai-sdk:preconfigured-mcp-client-agent
```

These agents connect to the configured MCP servers (defined in your code) and allow you to interact with the provided tools using natural language.

> If using `HederaMCPServer.HGRAPH_MCP_MAINNET`, ensure you have set the `HGRAPH_API_KEY` in your `.env` file. See [docs.hgraph.com](https://docs.hgraph.com/mcp-server/setup-claude) for details.

### Option H: Run the Policy Enforcement Agent

This example demonstrates how to use the **MaxRecipientsPolicy** to enforce rules on transactions. In this case, it restricts any HBAR transfer to a maximum of 2 recipients.

**Found at:**
- `examples/ai-sdk/policy-enforcement-agent.ts`
- `examples/langchain-v1/policy-enforcement-agent.ts`

#### Running the Example

##### AI SDK

```bash
cd examples/ai-sdk
npm install
npm run ai-sdk:policy-enforcement-agent
```

##### LangChain v1

```bash
cd examples/langchain-v1
npm install
npm run langchain:policy-enforcement-agent
```

---

### Option I: Run the Audit Trail Agent

This example demonstrates how to use the **HcsAuditTrailHook** to automatically audit specific actions (like HBAR transfers or token creation) by submitting audit logs to a Hedera Consensus Service (HCS) topic.

**Found at:**
- `examples/ai-sdk/audit-trail-agent.ts`
- `examples/langchain-v1/audit-trail-agent.ts`

> [!IMPORTANT]
> This agent works only in `mode: AgentMode.AUTONOMOUS`.

#### Running the Example

##### AI SDK

```bash
cd examples/ai-sdk
npm install
npm run ai-sdk:audit-trail-agent
```

##### LangChain v1

```bash
cd examples/langchain-v1
npm install
npm run langchain:audit-trail-agent
```

---

### Option J: Try out the Google ADK Agent

This example demonstrates how to use the Hedera Agent Kit with [Google's Agent Development Kit (ADK)](https://google.github.io/adk-docs/get-started/). It includes a plugin tool calling agent and supports the ADK Web GUI for interactive testing.

**Found at:**
- `examples/adk/`

#### Prerequisites

1. Configure your environment variables in `examples/adk/.env`. You will need your Hedera credentials and a Google AI API Key (Gemini).

```env
ACCOUNT_ID=0.0.xxxxx
PRIVATE_KEY=302e...
GEMINI_API_KEY=your-gemini-api-key
```

#### Running the Example

1. Navigate to the example directory:

```bash
cd examples/adk
npm install
```

2. Run the CLI agent:

```bash
npm run adk:plugin-tool-calling-agent
```

3. Or run the ADK Web GUI:

```bash
npx adk web
```

This will start a local web server (by default at `http://localhost:8000`) where you can interact with the Hedera agent visually.

> **Note:** It is strongly recommended to use the native ADK tools (`npx adk run agent.ts` and `npx adk web`) for interacting with ADK agents. The custom CLI implemented in `plugin-tool-calling-agent.ts` is provided solely as an example to demonstrate how building a custom CLI runner is possible.
