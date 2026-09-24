import { HederaADKToolkit, PolicyResultParser } from '@hashgraph/hedera-agent-kit-adk';
import { AgentMode, AbstractPolicy } from '@hashgraph/hedera-agent-kit';
import { MaxRecipientsPolicy } from '@hashgraph/hedera-agent-kit/policies';
import {
  coreAccountPlugin,
  coreTokenPlugin,
  coreAccountPluginToolNames,
} from '@hashgraph/hedera-agent-kit/plugins';
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  isFinalResponse,
  getFunctionResponses,
} from '@google/adk';
import { Content, Part } from '@google/genai';

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

const APP_NAME = 'hedera_policy_agent_app';
const USER_ID = 'hedera_user';
const SESSION_ID = 'policy_session_1';

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
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
  const hederaAgentToolkit = new HederaADKToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin, coreTokenPlugin],
      tools: [], // Load all tools from selected plugins
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: process.env.ACCOUNT_ID,
        hooks: [maintenancePolicy, maxRecipientsPolicy],
      },
    },
  });

  // Parser for extracting structured policy-block data from ADK tool results.
  const parser = new PolicyResultParser();

  const agent = new LlmAgent({
    name: 'hedera_policy_agent',
    description:
      'An AI agent that can interact with the Hedera blockchain network with policy enforcement.',
    model: 'gemini-3.1-flash-lite-preview',
    instruction:
      'You are a helpful assistant with access to Hedera blockchain tools. ' +
      'You can help users transfer HBAR and manage tokens. ' +
      'DO NOT split transactions that are to multiple recipients into separate transactions.',
    tools: hederaAgentToolkit.getTools(),
  });

  // Setup session and runner
  const sessionService = new InMemorySessionService();
  await sessionService.createSession({
    appName: APP_NAME,
    sessionId: SESSION_ID,
    userId: USER_ID,
  });

  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService,
  });

  console.log('='.repeat(60));
  console.log('Hedera Agent CLI Chatbot with Policy Enforcement (ADK)');
  console.log('='.repeat(60));
  console.log("Type 'exit' or 'quit' to end the session.\n");
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
    try {
      const { userInput } = await prompts({
        type: 'text',
        name: 'userInput',
        message: 'You:',
      });

      // Handle early termination
      if (!userInput || ['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
        console.log('Goodbye!');
        break;
      }

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

      // Collect tool results from function-response events during this turn.
      // ADK's FunctionTool.execute returns { raw, humanMessage } which ADK exposes
      // as FunctionResponse.response. getFunctionResponses() extracts these from
      // each event so we can classify them with PolicyResultParser after the turn.
      const turnToolResults: any[] = [];

      // Process events and print the final response
      for await (const event of events) {
        // Accumulate tool results from this event (if any)
        for (const fr of getFunctionResponses(event)) {
          if (fr.response) turnToolResults.push(fr.response);
        }

        if (isFinalResponse(event)) {
          // Print the AI's answer (prose message — what the LLM sees)
          const textParts: string[] = [];
          if (event.content?.parts) {
            for (const part of event.content.parts) {
              if ((part as any).functionCall) continue; // skip function calls
              if (part.text) textParts.push(part.text);
            }
          }
          if (textParts.length > 0) {
            console.log(`AI: ${textParts.join(' ')}`);
          }

          // -----------------------------------------------------------------------
          // Parser usage: extract structured policy-block data from tool results.
          //
          // parsePolicyBlocks() filters to only the `kind: 'policy_block'` entries,
          // giving you typed fields for programmatic branching without substring-
          // matching the prose message.
          // -----------------------------------------------------------------------
          const policyBlocks = parser.parsePolicyBlocks(turnToolResults);
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
