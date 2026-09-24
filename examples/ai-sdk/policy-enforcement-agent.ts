import { AgentMode, AbstractPolicy } from '@hashgraph/hedera-agent-kit';
import { HederaAIToolkit, PolicyResultParser } from '@hashgraph/hedera-agent-kit-ai-sdk';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';
import { coreAccountPlugin, coreAccountPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

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

  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin], // Load coreAccountPlugin which includes transfer HBAR tool
      tools: [], // Load all tools from the selected plugin
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorId,
        hooks: [maintenancePolicy, maxRecipientsPolicy],
      },
    },
  });

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  // Parser for extracting structured policy-block data from AI SDK tool results.
  const parser = new PolicyResultParser();

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

      // Print the AI's answer (prose message — what the LLM sees)
      console.log(`AI: ${response.text}`);

      // -----------------------------------------------------------------------
      // Parser usage: extract structured policy-block data from tool results.
      //
      // response.steps contains one entry per LLM round-trip; each step has a
      // toolResults array whose entries have an `output` field with the
      // { raw, humanMessage } envelope returned by the Hedera tool.
      //
      // parsePolicyBlocks() filters to only the `kind: 'policy_block'` entries,
      // giving you typed fields for programmatic branching without substring-
      // matching the prose message.
      // -----------------------------------------------------------------------
      const allToolResults = response.steps.flatMap((step) => step.toolResults ?? []);
      const policyBlocks = parser.parsePolicyBlocks(allToolResults);

      if (policyBlocks.length > 0) {
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

bootstrap()
  .catch(err => {
    console.error('Fatal error during CLI bootstrap:', err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
