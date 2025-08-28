import { HederaLangchainToolkit, AgentMode, coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin, coreTokenPluginToolNames, coreQueriesPluginToolNames, coreConsensusPluginToolNames, coreAccountPluginToolNames, coreEVMPluginToolNames, coreEVMPlugin } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import type { ChatPromptTemplate } from '@langchain/core/prompts';
import { pull } from 'langchain/hub';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap(): Promise<void> {
  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4.1',
  });

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );

  // all the available tools
  const {
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    AIRDROP_FUNGIBLE_TOKEN_TOOL,
    MINT_NON_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
  } = coreTokenPluginToolNames;

  const {
    TRANSFER_HBAR_TOOL,
  } = coreAccountPluginToolNames;

  const {
    CREATE_TOPIC_TOOL,
    SUBMIT_TOPIC_MESSAGE_TOOL,
  } = coreConsensusPluginToolNames;

  const {
    GET_HBAR_BALANCE_QUERY_TOOL,
    GET_ACCOUNT_QUERY_TOOL,
    GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    GET_TOPIC_MESSAGES_QUERY_TOOL,
  } = coreQueriesPluginToolNames;

  const {
    CREATE_ERC20_TOOL,
  } = coreEVMPluginToolNames;

  // Prepare Hedera toolkit (load all tools by default)
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [
        CREATE_FUNGIBLE_TOKEN_TOOL,
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        AIRDROP_FUNGIBLE_TOKEN_TOOL,
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        TRANSFER_HBAR_TOOL,
        CREATE_TOPIC_TOOL,
        SUBMIT_TOPIC_MESSAGE_TOOL,
        GET_HBAR_BALANCE_QUERY_TOOL,
        GET_ACCOUNT_QUERY_TOOL,
        GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
        GET_TOPIC_MESSAGES_QUERY_TOOL,
        MINT_FUNGIBLE_TOKEN_TOOL,
        CREATE_ERC20_TOOL,
      ], // use an empty array if you want to load all tools
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
      plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin, coreEVMPlugin],
    },
  });

  // Load the structured chat prompt template
  const prompt = await pull<ChatPromptTemplate>('hwchase17/structured-chat-agent');

  // Fetch tools from toolkit
  const tools = hederaAgentToolkit.getTools();

  const agent = await createStructuredChatAgent({
    llm,
    tools: tools,
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

  console.log('Hedera Agent CLI Chatbot — type "exit" to quit');

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
      // The structured-chat agent puts its final answer in `output`
      console.log(`AI: ${response?.output ?? response}`);
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

bootstrap().catch(err => {
  console.error('Fatal error during CLI bootstrap:', err);
  process.exit(1);
}).then(() => {
  process.exit(0);
});
