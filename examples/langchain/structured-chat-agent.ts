import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createStructuredChatAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { ChatPromptTemplate } from '@langchain/core/prompts';

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
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
  );

  // Prepare Hedera toolkit
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
      plugins: [
        coreTokenPlugin,
        coreAccountPlugin,
        coreConsensusPlugin,
        coreEVMPlugin,
        coreAccountQueryPlugin,
        coreTokenQueryPlugin,
        coreConsensusQueryPlugin,
        coreEVMQueryPlugin,
        coreMiscQueriesPlugin,
        coreTransactionQueryPlugin,
      ], // Load selected plugins
      tools: [], // Load all tools from selected plugins
    },
  });

  // Structured-chat (JSON-blob ReAct) prompt — inlined copy of the public
  // hwchase17/structured-chat-agent template so we don't depend on LangChain Hub.
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Respond to the human as helpfully and accurately as possible. You have access to the following tools:

{tools}

Use a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).

Valid "action" values: "Final Answer" or {tool_names}

Provide only ONE action per $JSON_BLOB, as shown:

\`\`\`
{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}
\`\`\`

Follow this format:

Question: input question to answer
Thought: consider previous and subsequent steps
Action:
\`\`\`
$JSON_BLOB
\`\`\`
Observation: action result
... (repeat Thought/Action/Observation N times)
Thought: I know what to respond
Action:
\`\`\`
{{
  "action": "Final Answer",
  "action_input": "Final response to human"
}}
\`\`\`

Begin! Reminder to ALWAYS respond with a valid json blob of a single action. Use tools if necessary. Respond directly if appropriate. Format is Action:\`\`\`$JSON_BLOB\`\`\`then Observation`,
    ],
    ['placeholder', '{chat_history}'],
    [
      'human',
      `{input}

{agent_scratchpad}
 (reminder to respond in a JSON blob no matter what)`,
    ],
  ]);

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

bootstrap()
  .catch(err => {
    console.error('Fatal error during CLI bootstrap:', err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
