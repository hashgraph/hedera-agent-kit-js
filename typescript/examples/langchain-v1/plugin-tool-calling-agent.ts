import {
  AgentMode,
  coreAccountPluginToolNames,
  coreAccountQueryPluginToolNames,
  coreConsensusPluginToolNames,
  coreConsensusQueryPluginToolNames,
  coreEVMPluginToolNames,
  coreEVMQueryPluginToolNames,
  coreMiscQueriesPluginsToolNames,
  coreTokenPluginToolNames,
  coreTokenQueryPluginToolNames,
  coreTransactionQueryPluginToolNames,
  HederaLangchainToolkit,
  ResponseParserService,
} from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { StructuredToolInterface } from '@langchain/core/tools';
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

  // all the available tools
  const {
    TRANSFER_HBAR_TOOL,
    CREATE_ACCOUNT_TOOL,
    DELETE_ACCOUNT_TOOL,
    UPDATE_ACCOUNT_TOOL,
    SIGN_SCHEDULE_TRANSACTION_TOOL,
    SCHEDULE_DELETE_TOOL,
    APPROVE_HBAR_ALLOWANCE_TOOL,
    TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
  } = coreAccountPluginToolNames;
  const {
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    AIRDROP_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
    MINT_NON_FUNGIBLE_TOKEN_TOOL,
    UPDATE_TOKEN_TOOL,
    DISSOCIATE_TOKEN_TOOL,
    ASSOCIATE_TOKEN_TOOL,
  } = coreTokenPluginToolNames;
  const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL, DELETE_TOPIC_TOOL, UPDATE_TOPIC_TOOL } =
    coreConsensusPluginToolNames;
  const {
    GET_ACCOUNT_QUERY_TOOL,
    GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    GET_HBAR_BALANCE_QUERY_TOOL,
  } = coreAccountQueryPluginToolNames;

  const { GET_TOPIC_MESSAGES_QUERY_TOOL, GET_TOPIC_INFO_QUERY_TOOL } =
    coreConsensusQueryPluginToolNames;
  const { GET_TOKEN_INFO_QUERY_TOOL, GET_PENDING_AIRDROP_TOOL } = coreTokenQueryPluginToolNames;
  const { GET_CONTRACT_INFO_QUERY_TOOL } = coreEVMQueryPluginToolNames;
  const { GET_TRANSACTION_RECORD_QUERY_TOOL } = coreTransactionQueryPluginToolNames;
  const { GET_EXCHANGE_RATE_TOOL } = coreMiscQueriesPluginsToolNames;

  const {
    TRANSFER_ERC721_TOOL,
    MINT_ERC721_TOOL,
    CREATE_ERC20_TOOL,
    TRANSFER_ERC20_TOOL,
    CREATE_ERC721_TOOL,
  } = coreEVMPluginToolNames;

  // Prepare Hedera toolkit with core tools AND custom plugin
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [
        // Core tools
        TRANSFER_HBAR_TOOL,
        CREATE_FUNGIBLE_TOKEN_TOOL,
        CREATE_TOPIC_TOOL,
        SUBMIT_TOPIC_MESSAGE_TOOL,
        DELETE_TOPIC_TOOL,
        GET_HBAR_BALANCE_QUERY_TOOL,
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        CREATE_ACCOUNT_TOOL,
        DELETE_ACCOUNT_TOOL,
        UPDATE_ACCOUNT_TOOL,
        AIRDROP_FUNGIBLE_TOKEN_TOOL,
        MINT_FUNGIBLE_TOKEN_TOOL,
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        ASSOCIATE_TOKEN_TOOL,
        GET_ACCOUNT_QUERY_TOOL,
        GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
        GET_TOPIC_MESSAGES_QUERY_TOOL,
        GET_TOKEN_INFO_QUERY_TOOL,
        GET_TRANSACTION_RECORD_QUERY_TOOL,
        GET_EXCHANGE_RATE_TOOL,
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        GET_CONTRACT_INFO_QUERY_TOOL,
        TRANSFER_ERC721_TOOL,
        MINT_ERC721_TOOL,
        CREATE_ERC20_TOOL,
        TRANSFER_ERC20_TOOL,
        CREATE_ERC721_TOOL,
        UPDATE_TOKEN_TOOL,
        GET_PENDING_AIRDROP_TOOL,
        DISSOCIATE_TOKEN_TOOL,
        SCHEDULE_DELETE_TOOL,
        GET_TOPIC_INFO_QUERY_TOOL,
        UPDATE_TOPIC_TOOL,
        APPROVE_HBAR_ALLOWANCE_TOOL,
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        // Plugin tools
        'example_greeting_tool',
        'example_hbar_transfer_tool',
      ],
      plugins: [], // Add all plugins by default
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  // Fetch tools from a toolkit
  const tools: StructuredToolInterface[] = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt:
      'You are a helpful assistant with access to Hedera blockchain tools and custom plugin tools',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(hederaAgentToolkit.getTools());

  console.log('Hedera Agent CLI Chatbot with Plugin Support — type "exit" to quit');
  console.log('Available plugin tools:');
  console.log('- example_greeting_tool: Generate personalized greetings');
  console.log(
    '- example_hbar_transfer_tool: Transfer HBAR to account 0.0.800 (demonstrates transaction strategy)',
  );
  console.log('');

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

      // Assuming a single tool call per response but parsedToolData might contain an array of tool calls made since the last agent.invoke
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
