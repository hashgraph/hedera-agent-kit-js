import { AgentMode, HederaAIToolkit, HederaMCPServer } from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

dotenv.config();

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );
  // Prepare Hedera toolkit with core tools AND configurations
  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      tools: [],
      plugins: [], //Load all plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
      mcpServers: [HederaMCPServer.HEDERION_MCP_MAINNET], // the the testnet MCP server is not available yet
    },
  });

  const mcpTools = await hederaAgentToolkit.getMcpTools();
  const hakTools = hederaAgentToolkit.getTools();

  console.log(`Loaded ${hakTools.length} Hedera Agent Kit tools.`);
  console.log(`Loaded ${mcpTools.length} MCP tools.`);

  const allTools = { ...hakTools, ...mcpTools };

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  console.log('Hedera Agent CLI Chatbot with MCP Support — type "exit" to quit');
  console.log('Available MCP tools loaded from configured servers.');
  console.log('Available tools:', Object.keys(allTools).join(', '));
  console.log('');

  // Chat memory: conversation history
  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

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

    // Add a user message to the history
    conversationHistory.push({ role: 'user', content: userInput });

    try {
      const response = await generateText({
        model,
        messages: conversationHistory,
        tools: allTools,
        stopWhen: stepCountIs(5), // Increased steps to allow for multiple tool usages
      });

      // Add AI response to history
      conversationHistory.push({ role: 'assistant', content: response.text });

      // Print the AI's answer
      console.log(`AI: ${response.text}`);
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
