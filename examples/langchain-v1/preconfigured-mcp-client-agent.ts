import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { coreMiscQueriesPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import {
  HederaLangchainToolkit,
  ResponseParserService,
  HederaMCPServer,
} from '@hashgraph/hedera-agent-kit-langchain';
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

function validateEnv() {
  const required = ['ACCOUNT_ID', 'PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
  );

  // Prepare Hedera toolkit with selected core plugin and MCP servers
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [coreMiscQueriesPlugin], // only one plugin, other tools will be available through the MCP
      tools: [], // load all tools from selected plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
      mcpServers: [
        HederaMCPServer.HEDERION_MCP_MAINNET,
        HederaMCPServer.HGRAPH_MCP_MAINNET, // requires HGRAPH_API_KEY env var
      ], // only mainnet servers are available
    },
  });

  // Fetch all tools from the external MCP
  const mcpTools: StructuredToolInterface[] = await hederaAgentToolkit.getMcpTools();

  // Fetch tools from a toolkit
  const hakTools: StructuredToolInterface[] = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = createAgent({
    model: llm,
    tools: [...mcpTools, ...hakTools],
    systemPrompt:
      'You are a helpful assistant with access to Hedera blockchain tools and custom plugin tools',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(hederaAgentToolkit.getTools());

  console.log('Hedera Agent CLI Chatbot with Plugin Support — type "exit" to quit');
  console.log(
    "To see what tools are available, ask agent 'What tools are available?' in the CLI.\n",
  );

  while (true) {
    const { userInput } = await prompts({
      type: 'text',
      name: 'userInput',
      message: 'You',
    });

    // Handle early termination
    if (!userInput || ['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
      console.log('Goodbye!');
      break;
    }

    try {
      const response = await agent.invoke(
        { messages: [{ role: 'user', content: userInput }] },
        { configurable: { thread_id: '1' } },
      );

      console.log(JSON.stringify(response, null, 2));

      const parsedToolData = responseParsingService.parseNewToolMessages(response);

      // Assuming a single tool call per response, but parsedToolData might contain an array of tool calls made since the last agent.invoke
      const toolCall = parsedToolData[0];

      // 1. Handle case when NO tool was called (simple chat)
      if (!toolCall) {
        console.log(
          `AI: ${response.messages[response.messages.length - 1].content ?? JSON.stringify(response)}`,
        );
        // 2. Handle QUERY tool calls
      } else {
        console.log(
          `\nAI: ${response.messages[response.messages.length - 1].content ?? JSON.stringify(response)}`,
        ); // <- agent response text generated based on the tool call response
        // MCPs response format differs from HAK Tools
        // console.log('\n--- Tool Data ---');
        // console.log('Direct tool response:', toolCall.parsedData.humanMessage); // <- you can use this string for a direct tool human-readable response.
        // console.log('Full tool response object:', JSON.stringify(toolCall.parsedData, null, 2)); // <- you can use this object for convenient tool response extraction
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

bootstrap()
  .catch(err => {
    console.error('Fatal error during CLI bootstrap:', err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
