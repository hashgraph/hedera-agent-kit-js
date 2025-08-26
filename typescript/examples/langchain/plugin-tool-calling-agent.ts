import {
  HederaLangchainToolkit,
  AgentMode,
  coreHTSPluginToolNames,
  coreConsensusPluginToolNames,
  coreQueriesPluginToolNames,
  coreQueriesPlugin,
  coreHTSPlugin,
  coreConsensusPlugin,
  coreAccountPlugin,
  coreAccountPluginToolNames,
} from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { examplePlugin } from '../plugin/example-plugin';
dotenv.config();

async function bootstrap(): Promise<void> {
  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );

  // all the available tools
  const { CREATE_FUNGIBLE_TOKEN_TOOL } = coreHTSPluginToolNames;

  const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL } = coreConsensusPluginToolNames;

  const {
    GET_HBAR_BALANCE_QUERY_TOOL,
    GET_TOKEN_INFO_QUERY_TOOL,
  } = coreQueriesPluginToolNames;


  const { UPDATE_ACCOUNT_TOOL } = coreAccountPluginToolNames;

  // Prepare Hedera toolkit with core tools AND custom plugin
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [
        // Core tools
        CREATE_TOPIC_TOOL,
        SUBMIT_TOPIC_MESSAGE_TOOL,
        CREATE_FUNGIBLE_TOKEN_TOOL,
        GET_HBAR_BALANCE_QUERY_TOOL,
        UPDATE_ACCOUNT_TOOL,
        GET_TOKEN_INFO_QUERY_TOOL,
        // Plugin tools
        'example_greeting_tool',
        'example_hbar_transfer_tool',
      ],
      plugins: [
        examplePlugin,
        coreHTSPlugin,
        coreConsensusPlugin,
        coreQueriesPlugin,
        coreAccountPlugin,
      ], // Add the example plugin
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  // Load the structured chat prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are a helpful assistant with access to Hedera blockchain tools and custom plugin tools',
    ],
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

  // In-memory conversation history
  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    inputKey: 'input',
    outputKey: 'output',
    returnMessages: true,
  });

  // Wrap everything in an executor that will maintain memory
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: false,
  });

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
      const response = await agentExecutor.invoke({ input: userInput });
      console.log(`AI: ${response?.output ?? response}`);
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
