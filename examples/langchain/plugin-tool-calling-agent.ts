import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
  coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
  coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';

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

  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );

  // Prepare Hedera toolkit with core tools AND custom plugin
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [],
      plugins: [
          coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
          coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
          coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
        ],
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
  const tools: StructuredToolInterface[] = hederaAgentToolkit.getTools();
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
