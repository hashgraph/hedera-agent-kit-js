import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { HederaAIToolkit } from '@hashgraph/hedera-agent-kit-ai-sdk';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';
import { coreAccountPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

dotenv.config();

async function bootstrap(): Promise<void> {
  const operatorId = process.env.ACCOUNT_ID!;
  const operatorKey = process.env.PRIVATE_KEY!;

  const client = Client.forTestnet().setOperator(
    operatorId,
    PrivateKey.fromStringECDSA(operatorKey),
    // PrivateKey.fromStringED25519(operatorKey), // Use this line if you have an ED25519 key
  );

  // Instantiate the MaxRecipientsPolicy, restricting transfers to a maximum of 2 recipients
  const policy = new MaxRecipientsPolicy(2);

  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin], // Load coreAccountPlugin which includes transfer HBAR tool
      tools: [], // Load all tools from the selected plugin
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorId,
        hooks: [policy],
      },
    },
  });

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  console.log('Hedera Agent CLI Chatbot with Policy Enforcement — type "exit" to quit');
  console.log('This agent explicitly loads tools related to Transfers and Airdrops.');
  console.log('MaxRecipientsPolicy is ACTIVE: All transfers to >2 recipients are blocked.');
  console.log('');

  // Chat memory: conversation history
  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  while (true) {
    const { userInput } = await prompts({
      type: 'text',
      name: 'userInput',
      message: 'You',
    });

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
        tools: hederaAgentToolkit.getTools(),
        stopWhen: stepCountIs(2),
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
