import { HederaAIToolkit, AgentMode, coreTokenPlugin, coreQueriesPlugin, coreAccountPlugin } from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, wrapLanguageModel } from 'ai';
dotenv.config();

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );
  // Prepare Hedera toolkit (load only selected tools)
  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      plugins: [
        coreTokenPlugin,
        coreQueriesPlugin,
        coreAccountPlugin
      ],
      context: {
        mode: AgentMode.AUTONOMOUS,
      },
    },
  });

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  console.log('Hedera Agent CLI Chatbot — type "exit" to quit');

  // Chat memory: conversation history
  const conversationHistory: { role: 'user' | 'assistant', content: string }[] = [];

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

    // Add user message to history
    conversationHistory.push({ role: 'user', content: userInput });

    try {
      const response = await generateText({
        model,
        messages: conversationHistory,
        tools: hederaAgentToolkit.getTools(),
        maxSteps: 2, // Important to set this to 2 to allow for the LLM to use the tool result to answer the user
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

bootstrap().catch(err => {
  console.error('Fatal error during CLI bootstrap:', err);
  process.exit(1);
}).then(() => {
  process.exit(0);
});
