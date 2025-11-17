import {
  AgentMode,
  HederaLangchainToolkit,
  ResponseParserService,
} from 'hedera-agent-kit';
import { Client, PrivateKey, Transaction } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { createAgent } from 'langchain';

dotenv.config();

async function bootstrap(): Promise<void> {
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
      tools: [], // use an empty array if you want to load all tools
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
      },
      plugins: [], // Load all plugins
    },
  });

  // Fetch tools from toolkit
  // cast to any to avoid excessively deep type instantiation caused by zod@3.25
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createAgent({
    model: "openai:gpt-4o-mini",
    tools: tools,
    systemPrompt:
      'You are a helpful Hedera assistant. You have Query Tools to read from the mirror node (e.g., check balance) and Transaction Tools to create transactions. Your Transaction Tools have two modes: "Return-Bytes" (prepare and return unsigned bytes, the tool calls wont execute the transactions) or "Execute-Transaction" (autonomously execute and return the receipt). Query tools always just return data.',
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
      const response = await agent.invoke({
        messages: [{ role: 'user', content: userInput }],
      });

      const parsedToolData = responseParsingService.parseNewToolMessages(response);

      // Assuming a single tool call per response but parsedToolData might contain an array of tool calls made since the last agent.invoke
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
        const bytesObject = toolCall.parsedData.raw.bytes;

        const realBytes = Buffer.isBuffer(bytesObject)
          ? bytesObject
          : Buffer.from(bytesObject.data);

        const tx = Transaction.fromBytes(realBytes);
        const result = await tx.execute(humanInTheLoopClient);
        const receipt = await result.getReceipt(humanInTheLoopClient);

        console.log('Transaction receipt:', receipt.status.toString());
        console.log('Transaction ID:', result.transactionId.toString());
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
