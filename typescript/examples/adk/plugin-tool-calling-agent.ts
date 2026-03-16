import { AgentMode, HederaADKToolkit } from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { LlmAgent, Runner, InMemorySessionService, isFinalResponse } from '@google/adk';
import { Content, Part } from '@google/genai';

dotenv.config();

const APP_NAME = 'hedera_agent_app';
const USER_ID = 'hedera_user';
const SESSION_ID = 'session_1';

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringDer(process.env.PRIVATE_KEY!),
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
  );

  // Prepare Hedera toolkit with core tools AND custom plugin
  const hederaAgentToolkit = new HederaADKToolkit({
    client,
    configuration: {
      plugins: [], // Load all plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: process.env.ACCOUNT_ID,
      },
    },
  });

  const agent = new LlmAgent({
    name: 'hedera_agent',
    description:
      'An AI agent that can interact with the Hedera blockchain network using various tools for account management, token operations, consensus service, and more.',
    model: 'gemini-3.1-flash-lite-preview',
    instruction:
      'You are a helpful assistant with access to Hedera blockchain tools. You can help users create accounts, transfer HBAR, manage tokens, create topics, and query blockchain information. Always provide clear explanations of the transactions you perform.',
    tools: hederaAgentToolkit.getTools(),
  });

  // Setup session and runner
  const sessionService = new InMemorySessionService();
  await sessionService.createSession({
    appName: APP_NAME,
    userId: USER_ID,
    sessionId: SESSION_ID,
  });

  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService,
  });

  console.log('='.repeat(60));
  console.log('Hedera Agent CLI Chatbot with Google ADK');
  console.log('='.repeat(60));
  console.log("Type 'exit' or 'quit' to end the session.\n");
  console.log('Example commands:');
  console.log("  - What's my current HBAR balance?");
  console.log("  - Create a new topic with memo 'Daily Updates'");
  console.log('  - Transfer 1 HBAR to account 0.0.12345');
  console.log("  - Create a fungible token called 'MyToken' with symbol 'MTK'\n");

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
      // Create user message content
      const newMessage: Content = {
        role: 'user',
        parts: [{ text: userInput } as Part],
      };

      // Run the agent via the Runner
      const events = runner.runAsync({
        userId: USER_ID,
        sessionId: SESSION_ID,
        newMessage,
      });

      // Process events and print the final response
      for await (const event of events) {
        if (isFinalResponse(event)) {
          const textParts: string[] = [];
          if (event.content?.parts) {
            for (const part of event.content.parts) {
              // Skip function calls
              if ((part as any).functionCall) {
                continue;
              }
              if (part.text) {
                textParts.push(part.text);
              }
            }
          }
          if (textParts.length > 0) {
            const finalResponse = textParts.join(' ');
            console.log(`AI: ${finalResponse}`);
          }
        }
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
