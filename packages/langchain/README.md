# @hashgraph/hedera-agent-kit-langchain

LangChain integration for Hedera Agent Kit. Wraps Hedera tools as LangChain `StructuredTool` instances so you can use them with LangChain agents and LangGraph workflows.

## Getting started

### 1. Install dependencies

```bash
npm install @hashgraph/hedera-agent-kit-langchain @hashgraph/hedera-agent-kit @hiero-ledger/sdk @langchain/openai dotenv
```

### 2. Configure environment variables

Create a `.env` file:

```
ACCOUNT_ID=0.0.12345
PRIVATE_KEY=302e...
OPENAI_API_KEY=sk-...
```

Get your Hedera testnet keys at https://portal.hedera.com/dashboard. We recommend using the DER-encoded private key.

### 3. Create an agent

```typescript
import 'dotenv/config';
import { Client, AccountId, PrivateKey } from '@hiero-ledger/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { AgentMode } from '@hashgraph/hedera-agent-kit';

const client = Client.forTestnet();
client.setOperator(
  AccountId.fromString(process.env.ACCOUNT_ID!),
  PrivateKey.fromStringDer(process.env.PRIVATE_KEY!),
);

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const agent = createReactAgent({ llm, tools: toolkit.getTools() });

const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Create a new Hedera account' }],
});

console.log(response.messages.at(-1)?.content);
```

## Parsing tool responses

Use `ResponseParserService` to extract structured data from agent responses:

```typescript
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

const parser = new ResponseParserService(toolkit.getTools());
const response = await agent.invoke({ messages: [...] });
const parsed = parser.parseNewToolMessages(response);

console.log(parsed[0].toolName);   // e.g. "create_account_tool"
console.log(parsed[0].parsedData); // tool execution result
```

## MCP server support

The toolkit can also load tools from external MCP servers:

```typescript
import { HederaMCPServer } from '@hashgraph/hedera-agent-kit-langchain';

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
    mcpServers: [HederaMCPServer.HEDERION_MCP_MAINNET],
  },
});

const mcpTools = await toolkit.getMcpTools();
const allTools = [...toolkit.getTools(), ...mcpTools];
```

## License

Apache-2.0
