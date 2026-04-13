import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreAccountQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  coreTokenQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import {
  HederaLangchainToolkit,
  ResponseParserService,
} from '@hashgraph/hedera-agent-kit-langchain';
import { HcsAuditTrailHook } from '@hashgraph/hedera-agent-kit/hooks';

dotenv.config();

async function bootstrap(): Promise<void> {
  const operatorId = process.env.ACCOUNT_ID!;
  const operatorKey = process.env.PRIVATE_KEY!;

  const client = Client.forTestnet().setOperator(
    operatorId,
    PrivateKey.fromStringECDSA(operatorKey),
    // PrivateKey.fromStringED25519(operatorKey), // Use this line if you have an ED25519 key
  );

  // Initialize the audit trail hook
  const auditHook = new HcsAuditTrailHook(
    [
      coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
      coreTokenPluginToolNames.CREATE_FUNGIBLE_TOKEN_TOOL,
    ],
    '0.0.????', // Replace with your actual topic ID
  );

  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [
        coreAccountPlugin,
        coreAccountQueryPlugin,
        coreConsensusPlugin,
        coreConsensusQueryPlugin,
        coreTokenPlugin,
        coreTokenQueryPlugin,
      ], // Load selected plugins
      tools: [], // Load all tools from selected plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorId,
        hooks: [auditHook],
      },
    },
  });

  const tools = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  });

  const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt:
      'You are a helpful assistant with access to Hedera blockchain tools. ' +
      'Remember that some of your actions (transfers, token creation) are automatically audited on the consensus service.',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(tools);

  console.log(
    'Hedera Agent CLI Chatbot with HcsAuditTrailHook Plugin Support — type "exit" to quit',
  );
  console.log('This agent has an audit hook on TRANSFER_HBAR_TOOL and CREATE_FUNGIBLE_TOKEN_TOOL.');
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
        console.log(
          '= Direct tool response =\n',
          toolCall.parsedData.humanMessage || 'No human message available',
        );
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
