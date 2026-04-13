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
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import { Client, PrivateKey, Transaction } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';

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

  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);
  // const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!); // Use this line if you have an ED25519 key

  // Hedera client setup (Testnet by default)
  const humanInTheLoopClient = Client.forTestnet().setOperator(
    operatorAccountId,
    operatorPrivateKey,
  );

  const agentClient = Client.forTestnet();

  // Prepare Hedera toolkit
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client: agentClient,
    configuration: {
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
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
        try {
          const realBytes = parseTransactionBytes(bytes);
          const tx = Transaction.fromBytes(realBytes);
          const result = await tx.execute(humanInTheLoopClient);
          const receipt = await result.getReceipt(humanInTheLoopClient);
          console.log('Transaction receipt:', receipt.status.toString());
          console.log('Transaction result:', result.transactionId.toString());
        } catch (error) {
          console.error('Error executing transaction from bytes:', error);
        }
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

/**
 * Helper to robustly parse transaction bytes from various serialization formats.
 */
function parseTransactionBytes(bytesObject: any): Buffer {
  if (Buffer.isBuffer(bytesObject)) {
    return bytesObject;
  }

  // Handle Node.js Buffer serialization: { type: 'Buffer', data: [...] }
  if (
    typeof bytesObject === 'object' &&
    bytesObject !== null &&
    'data' in bytesObject &&
    Array.isArray((bytesObject as any).data)
  ) {
    return Buffer.from((bytesObject as any).data);
  }

  // Handle Web/Browser Uint8Array serialization or array-like objects: { "0": 10, "1": 75... }
  // Object.values guarantees order for integer keys in modern JS environments
  if (typeof bytesObject === 'object' && bytesObject !== null) {
    const values = Object.values(bytesObject);
    // specific check to see if we have an array of number
    if (values.every(v => typeof v === 'number')) {
      return Buffer.from(values as number[]);
    }
  }

  // Fallback / Error
  throw new Error(`Unable to parse bytes from object: ${JSON.stringify(bytesObject)}`);
}
