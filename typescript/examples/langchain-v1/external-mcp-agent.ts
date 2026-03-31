import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import {
  AgentMode,
  coreMiscQueriesPlugin,
  HederaLangchainToolkit,
  ResponseParserService,
} from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringDer(process.env.PRIVATE_KEY!),
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
  );

  // Prepare Hedera toolkit with core tools AND custom plugin
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [],
      plugins: [coreMiscQueriesPlugin], // only one plugin, other tools will be available through the MCP
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  // create an MCP client with a use of @langchain/mcp-adapters
  const mcpClient = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    useStandardContentBlocks: true,
    mcpServers: {
      hedera: {
        command: 'node',
        args: [
          '<YOUR PATH TO>/hedera-agent-kit-js/modelcontextprotocol/dist/index.js', // IMPORTANT: replace it with your actual path to the MCP server JS compiled file
          '--ledger-id=testnet',
        ],
        env: {
          HEDERA_OPERATOR_ID: process.env.ACCOUNT_ID!,
          HEDERA_OPERATOR_KEY: process.env.PRIVATE_KEY!,
        },
      },
    },
  });

  // Fetch all tools from the external MCP
  const mcpTools: StructuredToolInterface[] = await mcpClient.getTools();

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
        console.log('\n--- Tool Data ---');
        console.log('Direct tool response:', toolCall.parsedData.humanMessage); // <- you can use this string for a direct tool human-readable response.
        console.log('Full tool response object:', JSON.stringify(toolCall.parsedData, null, 2)); // <- you can use this object for convenient tool response extraction
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
