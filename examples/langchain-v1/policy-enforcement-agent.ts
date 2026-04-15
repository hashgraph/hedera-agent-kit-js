import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  HederaLangchainToolkit,
  ResponseParserService,
} from '@hashgraph/hedera-agent-kit-langchain';
import { coreAccountPlugin, coreTokenPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';

import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const operatorId = process.env.ACCOUNT_ID!;
  const operatorKey = process.env.PRIVATE_KEY!;

  const client = Client.forTestnet().setOperator(
    operatorId,
    PrivateKey.fromStringECDSA(operatorKey),
    // PrivateKey.fromStringED25519(operatorKey), // Use this line if you have an ED25519 key
  );

  // Instantiate the MaxRecipientsPolicy, restricting transfers to a maximum of 2 recipients
  const policy = new MaxRecipientsPolicy(2);

  // Prepare Hedera toolkit with policy enforcement
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin, coreTokenPlugin], // Load coreAccountPlugin which includes transfer HBAR tool and coreTokenPlugin which includes transfer token tool
      tools: [], // Load all tools from selected plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorId,
        hooks: [policy],
      },
    },
  });

  const tools = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt:
      'You are a helpful assistant with access to Hedera blockchain tools. ' +
      'You can help users perform transactions.' +
      'DO NOT split transactions that are to multiple recipients into separate transactions',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(tools);

  console.log('Hedera Agent CLI Chatbot with Policy Enforcement — type "exit" to quit');
  console.log('This agent explicitly loads tools related to Transfers and Airdrops.');
  console.log('MaxRecipientsPolicy is ACTIVE: All transfers to >2 recipients are blocked.');
  console.log('');

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

    try {
      const response = await agent.invoke(
        { messages: [{ role: 'user', content: userInput }] },
        { configurable: { thread_id: '1' } },
      );

      const parsedToolData = responseParsingService.parseNewToolMessages(response);
      const toolCall = parsedToolData[0];

      if (!toolCall) {
        console.log(`AI: ${response.messages[response.messages.length - 1].content}`);
      } else {
        console.log(`AI: ${response.messages[response.messages.length - 1].content}`);
        console.log('\n=== Tool Data ===');
        console.log('= Direct tool response =\n', toolCall.parsedData.humanMessage);
        console.log('\n= Full tool response =');
        console.log(JSON.stringify(toolCall.parsedData, null, 2));
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

bootstrap().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
