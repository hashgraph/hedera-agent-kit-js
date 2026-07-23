import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaAIToolkit } from '@hashgraph/hedera-agent-kit-ai-sdk';
import { Client, PrivateKey, Transaction } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';
dotenv.config();

function validateEnv() {
  const required = ['ACCOUNT_ID', 'PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
}

// In RETURN_BYTES mode the tool output is a JSON string, and after that round-trip the
// transaction bytes arrive as a Node Buffer JSON object ({ type: 'Buffer', data: number[] }),
// so rebuild the Uint8Array before deserializing.
function toUint8Array(bytes: any): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes?.type === 'Buffer' && Array.isArray(bytes.data)) return new Uint8Array(bytes.data);
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (bytes && typeof bytes === 'object') return new Uint8Array(Object.values(bytes) as number[]);
  return new Uint8Array();
}

async function bootstrap(): Promise<void> {
  validateEnv();

  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);
  // const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!); // Use this line if you have an ED25519 key

  // Client that signs and submits the returned bytes (the "human in the loop" step).
  const humanInTheLoopClient = Client.forTestnet().setOperator(
    operatorAccountId,
    operatorPrivateKey,
  );

  // The agent's client never signs in RETURN_BYTES mode — it only freezes transactions.
  const agentClient = Client.forTestnet();

  // Prepare Hedera toolkit in RETURN_BYTES mode. `accountId` is required: it is the payer used
  // to generate the transaction ID before freezing.
  const hederaAgentToolkit = new HederaAIToolkit({
    client: agentClient,
    configuration: {
      plugins: [
        coreTokenPlugin,
        coreAccountPlugin,
        coreConsensusPlugin,
        coreEVMPlugin,
        coreAccountQueryPlugin,
        coreTokenQueryPlugin,
        coreConsensusQueryPlugin,
        coreEVMQueryPlugin,
        coreMiscQueriesPlugin,
        coreTransactionQueryPlugin,
      ],
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId: operatorAccountId,
      },
    },
  });

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  console.log('Hedera Agent CLI Chatbot (RETURN_BYTES) — type "exit" to quit');

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
        tools: hederaAgentToolkit.getTools(),
        stopWhen: stepCountIs(2),
      });

      // Add AI response to history
      conversationHistory.push({ role: 'assistant', content: response.text });
      console.log(`AI: ${response.text}`);

      // `response.toolResults` only reflects the last step, so flatten every step to be sure we
      // catch the transaction tool call.
      const toolResults = response.steps.flatMap(step => step.toolResults);

      for (const toolResult of toolResults) {
        // The ai-sdk tool output is a JSON string of the tool's return value.
        const envelope =
          typeof toolResult.output === 'string'
            ? JSON.parse(toolResult.output)
            : (toolResult.output as any);

        // Only transaction tools return bytes; query tools are skipped here.
        if (!envelope?.bytes) continue;

        const bytes = toUint8Array(envelope.bytes);

        // RETURN_BYTES mode returns a structured ReturnBytesResult envelope alongside the raw
        // bytes. Print everything the caller needs to review, sign, and verify the transaction.
        console.log(`\n--- RETURN_BYTES envelope (tool: ${toolResult.toolName}) ---`);
        console.log(
          JSON.stringify(
            {
              status: envelope.status,
              type: envelope.type,
              transactionId: envelope.transactionId,
              payerAccountId: envelope.payerAccountId,
              expiresAt: envelope.expiresAt,
              memo: envelope.memo,
              bytesLength: bytes.length,
            },
            null,
            2,
          ),
        );

        // Human-in-the-loop: sign and submit the returned bytes with the local operator key.
        const tx = Transaction.fromBytes(bytes);
        const result = await tx.execute(humanInTheLoopClient);
        const receipt = await result.getReceipt(humanInTheLoopClient);
        console.log('Transaction receipt:', receipt.status.toString());
        console.log('Transaction ID:', result.transactionId.toString());
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
