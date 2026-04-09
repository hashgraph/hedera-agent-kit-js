import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
  coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
  coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit, ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client, PrivateKey, Transaction } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';

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

  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);
  // const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!); // Use this line if you have an ED25519 key

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
      tools: [], // use an empty array if you want to load all tools
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
      },
      plugins: [
          coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin, coreEVMPlugin,
          coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin,
          coreEVMQueryPlugin, coreMiscQueriesPlugin, coreTransactionQueryPlugin,
        ],
    },
  });

  // Fetch tools from toolkit
  // cast to any to avoid excessively deep type instantiation caused by zod@3.25
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createAgent({
    model: 'openai:gpt-4o-mini',
    tools: tools,
    systemPrompt:
      'You are a helpful Hedera assistant. You have Query Tools to read from the mirror node (e.g., check balance) and Transaction Tools to create transactions. Your Transaction Tools have two modes: "Return-Bytes" (prepare and return unsigned bytes, the tool calls wont execute the transactions) or "Execute-Transaction" (autonomously execute and return the receipt). Query tools always just return data.',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(hederaAgentToolkit.getTools());

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
        continue;
      }

      // 2. Handle RETURN_BYTES mode
      if (toolCall.parsedData?.raw?.bytes) {
        console.log('Transaction bytes found. Executing...');

        try {
          const realBytes = parseTransactionBytes(toolCall.parsedData.raw.bytes);
          const tx = Transaction.fromBytes(realBytes);
          const result = await tx.execute(humanInTheLoopClient);
          const receipt = await result.getReceipt(humanInTheLoopClient);

          console.log('Transaction receipt:', receipt.status.toString());
          console.log('Transaction ID:', result.transactionId.toString());
        } catch (error) {
          console.error('Error executing transaction from bytes:', error);
        }
      }
      // 3. Handle QUERY tool calls
      else {
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
