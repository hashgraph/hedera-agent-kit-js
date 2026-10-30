import { HederaAIToolkit, HederaMCPServer } from '@hashgraph/hedera-agent-kit-ai-sdk';
import { Client } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, type ModelMessage } from 'ai';
import {
  InMemoryOAuthClientProvider,
  startOAuthCallbackServer,
} from './utils/hedera-network-mcp-auth';

dotenv.config();

/**
 * Hosted Hedera Network MCP (testnet): https://agentic-testnet-mcp.hedera.com/mcp
 *
 * - No account ID or private key is configured here. You sign in with your own wallet
 *   (HashPack, Kabila, ... via WalletConnect) and the account comes from that sign-in.
 * - Read-only tools return immediately. Write tools build + freeze a transaction and deliver it
 *   to your wallet; you approve (sign + submit) it there. The agent then polls
 *   `check_signing_status` with the returned `requestId`.
 */
const SYSTEM_PROMPT = `You are a helpful assistant connected to the Hedera testnet through the hosted Hedera Network MCP.
- At the start of the conversation, call wallet_status to learn which account and network the user is connected to.
- Write tools do NOT execute transactions. They send the transaction to the user's wallet and return a requestId.
  You cannot wait, and you must NOT call check_signing_status in the same turn as the write tool.
  Instead, end your turn with a short message like: "I sent the transaction to your wallet. Please approve it there
  (you have about 180 seconds), then ask me for its status and I will check it for you." Remember the requestId.
- Never say a transaction was executed, created or sent unless check_signing_status returned executed for it.
- When the user asks about a transaction's status (e.g. "was it done?"), call check_signing_status with the stored requestId and report the result:
  - awaiting_approval: it is still waiting in the wallet; ask the user to approve it and then ask again.
  - confirming: the wallet submitted it and the network is confirming; ask the user to check again in a moment.
  - executed: confirmed on the network; share the details (e.g. transaction ID, Hashscan link) from the response.
  - rejected / failed / expired: tell the user what happened and offer to build the transaction again.
  - needs_reauth: the wallet session ended; tell the user to restart the example and sign in with their wallet again.
- If walletVerifiable is false (contract calls, file operations), show the user the tool's summary before they approve,
  because their wallet cannot fully display what the transaction does.
Do not call it a blockchain: Hedera is a public distributed ledger.`;

function validateEnv() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing required environment variable: OPENAI_API_KEY');
    console.error('Copy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  // The client is only needed to construct the toolkit; no operator: the wallet signs everything.
  const client = Client.forTestnet();

  const authProvider = new InMemoryOAuthClientProvider();
  const callbackServer = startOAuthCallbackServer(authProvider);

  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      plugins: [], // all tools come from the hosted MCP
      mcpServers: [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET],
      mcpAuth: {
        [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]: {
          authProvider,
          waitForAuthorizationCode: callbackServer.waitForCode,
        },
      },
    },
  });

  // Opens the wallet sign-in page on first use and waits for you to finish signing in.
  console.log('Connecting to the Hedera Network MCP (testnet)...');
  const mcpTools = await hederaAgentToolkit.getMcpTools();
  callbackServer.close();
  console.log(
    `Loaded ${Object.keys(mcpTools).length} MCP tools:`,
    Object.keys(mcpTools).join(', '),
  );

  console.log('\nHedera Network MCP Chatbot — type "exit" to quit');
  console.log('Try: "What is my HBAR balance?" or "Send 1 HBAR to 0.0.98765"\n');

  const conversationHistory: ModelMessage[] = [];

  while (true) {
    const { userInput } = await prompts({ type: 'text', name: 'userInput', message: 'You' });

    if (!userInput || ['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
      console.log('Goodbye!');
      break;
    }

    conversationHistory.push({ role: 'user', content: userInput });

    try {
      const response = await generateText({
        model: openai('gpt-5.4-nano'),
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
        tools: mcpTools,
        stopWhen: stepCountIs(10), // room for write tool + check_signing_status polling
      });

      // Keep tool calls and results too, so the requestId from a write tool survives to later turns.
      conversationHistory.push(...response.response.messages);
      console.log(`\nAI: ${response.text}\n`);
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
