import { AgentMode, AbstractPolicy } from '@hashgraph/hedera-agent-kit';
import {
  HederaLangchainToolkit,
  ResponseParserService,
} from '@hashgraph/hedera-agent-kit-langchain';
import {
  coreAccountPlugin,
  coreTokenPlugin,
  coreAccountPluginToolNames,
} from '@hashgraph/hedera-agent-kit/plugins';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';

import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

// ---------------------------------------------------------------------------
// Path 1 — simple boolean block (return true)
//
// Returning `true` from a `shouldBlock*` guard is the simplest way to block
// a tool call. AbstractPolicy automatically throws a base PolicyBlockedError
// carrying the policy name, description, blocked tool method, and hook stage
// — but no custom `details` payload.
//
// Set `enabled: true` to activate this policy and observe the base block.
// ---------------------------------------------------------------------------
class MaintenanceModePolicy extends AbstractPolicy {
  readonly name = 'Maintenance Mode Policy';
  readonly description = 'Transfers are temporarily disabled for maintenance';
  // Only applies to HBAR transfers; extend relevantTools to cover more methods.
  readonly relevantTools = [coreAccountPluginToolNames.TRANSFER_HBAR_TOOL];

  constructor(private readonly enabled: boolean) {
    super();
  }

  // Path 1: returning `true` causes AbstractPolicy to throw a base
  // PolicyBlockedError automatically — no custom details attached.
  protected shouldBlockPreToolExecution(): boolean {
    return this.enabled;
  }
}

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const operatorId = process.env.ACCOUNT_ID!;
  const operatorKey = process.env.PRIVATE_KEY!;

  const client = Client.forTestnet().setOperator(
    operatorId,
    PrivateKey.fromStringECDSA(operatorKey),
    // PrivateKey.fromStringED25519(operatorKey), // Use this line if you have an ED25519 key
  );

  // Path 1 — MaintenanceModePolicy (return true, no structured details).
  // Toggle `enabled` to `true` to see this path block transfers immediately.
  const maintenancePolicy = new MaintenanceModePolicy(false);

  // Path 2 — MaxRecipientsPolicy (throws PolicyBlockedError with structured details).
  // This policy throws with `details: { recipientCount, maxRecipients }` when the
  // number of recipients in a transfer exceeds the configured cap.
  // Trigger it by asking the agent to send HBAR to more than 2 recipients at once.
  const maxRecipientsPolicy = new MaxRecipientsPolicy(2);

  // Prepare Hedera toolkit with policy enforcement
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin, coreTokenPlugin], // Load coreAccountPlugin which includes transfer HBAR tool and coreTokenPlugin which includes transfer token tool
      tools: [], // Load all tools from selected plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorId,
        hooks: [maintenancePolicy, maxRecipientsPolicy],
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
  console.log('');
  console.log('Two policies are configured:');
  console.log(
    '  [Path 1] MaintenanceModePolicy — simple return-true block, no structured details.',
    'Set `enabled: true` in the source to activate.',
  );
  console.log(
    '  [Path 2] MaxRecipientsPolicy   — throws PolicyBlockedError with details.',
    'Ask the agent to send HBAR to >2 recipients at once to trigger it.',
  );
  console.log('');
  console.log(
    'When a policy blocks a tool the agent explains it in prose (humanMessage).',
    'The === Policy Block === section shows the structured data your code can branch on.',
  );
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

      // Print the AI's answer (prose message — what the LLM sees)
      console.log(`AI: ${response.messages[response.messages.length - 1].content}`);

      // Print the raw tool data as before
      const parsedToolData = responseParsingService.parseNewToolMessages(response);
      const toolCall = parsedToolData[0];
      if (toolCall) {
        console.log('\n=== Tool Data ===');
        console.log('= Direct tool response =\n', toolCall.parsedData.humanMessage);
        console.log('\n= Full tool response =');
        console.log(JSON.stringify(toolCall.parsedData, null, 2));
      }

      // -----------------------------------------------------------------------
      // Parser usage: extract structured policy-block data from the response.
      //
      // ResponseParserService.parsePolicyBlocks() runs parseNewToolMessages()
      // internally, classifies each tool result with classifyToolResult(), and
      // returns only the `kind: 'policy_block'` entries — typed fields for
      // programmatic branching without substring-matching the prose message.
      //
      // hasPolicyBlocks() is a quick boolean check if you only need to know
      // whether any block occurred before deciding to call parsePolicyBlocks().
      // -----------------------------------------------------------------------
      if (responseParsingService.hasPolicyBlocks(response)) {
        const policyBlocks = responseParsingService.parsePolicyBlocks(response);
        console.log('\n=== Policy Block(s) Detected ===');
        for (const block of policyBlocks) {
          console.log(`  Policy  : ${block.policyName}`);
          console.log(`  Stage   : ${block.stage}`);
          if (block.description) console.log(`  Reason  : ${block.description}`);
          if (block.details) console.log(`  Details : ${JSON.stringify(block.details)}`);
          console.log(`  Message : ${block.humanMessage}`);
          console.log('');
          // Example of programmatic branching on structured fields:
          // switch (block.policyName) {
          //   case 'Maintenance Mode Policy': await notifyOps(block); break;
          //   case 'Max Recipients Policy':   await queueForReview(block.details); break;
          // }
        }
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
