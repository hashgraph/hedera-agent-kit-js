/**
 * This file showcases an example integration of LangChain with the "Return-Bytes" MCP mode.
 * It demonstrates how an external agent can connect to an HTTP MCP server, receive unsigned 
 * transaction bytes, and then use its own local Hedera SDK client to sign and execute them.
 */
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { Client, PrivateKey, Transaction } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3001/mcp';

async function bootstrap(): Promise<void> {
  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringDer(process.env.PRIVATE_KEY!);
  // const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!); // Use this line if you have an ED25519 key

  // Hedera client for signing and executing the returned transaction bytes
  const humanInTheLoopClient = Client.forTestnet().setOperator(
    operatorAccountId,
    operatorPrivateKey,
  );

  // Connect to the external HTTP MCP server (running in RETURN_BYTES mode)
  // Passing the operator account ID via headers sets the account context dynamically
  const mcpClient = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    useStandardContentBlocks: true,
    mcpServers: {
      hedera: {
        url: MCP_SERVER_URL,
        transport: 'http',
        headers: {
          'x-hedera-account-id': operatorAccountId.toString(),
        },
      },
    },
  });

  // Fetch all tools from the external MCP
  const mcpTools: StructuredToolInterface[] = await mcpClient.getTools();

  console.log(`Loaded ${mcpTools.length} tools from MCP server at ${MCP_SERVER_URL}`);

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = createAgent({
    model: llm,
    tools: mcpTools,
    systemPrompt:
      'You are a helpful Hedera assistant. You have Query Tools to read from the mirror node (e.g., check balance) and Transaction Tools to create transactions. Your Transaction Tools operate in "Return-Bytes" mode: they prepare and return unsigned transaction bytes without executing them. Query tools always just return data.',
    checkpointer: new MemorySaver(),
  });

  console.log('Hedera Agent CLI (External MCP Return-Bytes) — type "exit" to quit');
  console.log(
    'The MCP server must be running in RETURN_BYTES mode: npm run start:http:return-bytes\n',
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

      const lastMessage = response.messages[response.messages.length - 1];
      const aiText = lastMessage.content ?? JSON.stringify(response);

      // Check if the response contains transaction bytes from a RETURN_BYTES tool call
      // MCP tool responses come as ToolMessage content, look for bytes pattern
      const toolMessages = response.messages.filter(
        (m: any) => m._getType?.() === 'tool' || m.constructor?.name === 'ToolMessage',
      );

      let bytesHandled = false;
      for (const toolMsg of toolMessages) {
        const content = typeof toolMsg.content === 'string' ? toolMsg.content : '';

        // Try to parse the tool response for transaction bytes
        try {
          const parsed = JSON.parse(content);
          if (parsed?.bytes || parsed?.raw?.bytes) {
            const bytesObject = parsed.bytes || parsed.raw.bytes;
            const realBytes = Buffer.isBuffer(bytesObject)
              ? bytesObject
              : Buffer.from(bytesObject.data || bytesObject);

            console.log('Transaction bytes found. Executing...');
            const tx = Transaction.fromBytes(realBytes);
            const result = await tx.execute(humanInTheLoopClient);
            const receipt = await result.getReceipt(humanInTheLoopClient);

            console.log('Transaction receipt:', receipt.status.toString());
            console.log('Transaction ID:', result.transactionId.toString());
            bytesHandled = true;
          }
        } catch {
          // Not JSON or no bytes — continue
        }
      }

      if (!bytesHandled) {
        console.log(`\nAI: ${aiText}`);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }

  // Clean up MCP client
  await mcpClient.close();
}

bootstrap()
  .catch(err => {
    console.error('Fatal error during CLI bootstrap:', err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
