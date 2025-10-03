import { AgentMode, HederaLangchainToolkit } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';
import { Client, PrivateKey, Transaction } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap(): Promise<void> {
  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);

  // Hedera client setup (Testnet by default)
  const humanInTheLoopClient = Client.forTestnet().setOperator(
    operatorAccountId,
    operatorPrivateKey,
  );

  const agentClient = Client.forTestnet();

  // Prepare Hedera toolkit (load all tools by default)
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client: agentClient,
    configuration: {
      tools: [], // use an empty array if you wantto load all tools
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
      },
      plugins: [], // Load all plugins
    },
  });

  // Load the structured chat prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Fetch tools from toolkit
  // cast to any to avoid excessively deep type instantiation caused by zod@3.25
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
    returnIntermediateSteps: true,
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
      console.log(`AI: ${response?.output ?? response}`);
      const bytes = extractBytesFromAgentResponse(response);
      if (bytes !== undefined) {
        const realBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.data);
        const tx = Transaction.fromBytes(realBytes);
        const result = await tx.execute(humanInTheLoopClient);
        const receipt = await result.getReceipt(humanInTheLoopClient);
        console.log('Transaction receipt:', receipt.status.toString());
        console.log('Transaction result:', result.transactionId.toString());
      } else {
        console.log('No transaction bytes found in the response.');
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

function extractBytesFromAgentResponse(response: any): any {
  if (
    response.intermediateSteps &&
    response.intermediateSteps.length > 0 &&
    response.intermediateSteps[0].observation
  ) {
    const obs = response.intermediateSteps[0].observation;
    try {
      const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
      if (obsObj.bytes) {
        return obsObj.bytes;
      }
    } catch (e) {
      console.error('Error parsing observation:', e);
    }
  }
  return undefined;
}
