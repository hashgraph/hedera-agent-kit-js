import { AgentMode, TransactionStrategy, ExecuteStrategy, RawTransactionResponse, Context } from '@hashgraph/hedera-agent-kit';
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
import { Client, PrivateKey, Transaction, TransactionId } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';
import readline from 'readline';

dotenv.config();

/**
 * A custom transaction signing strategy that prompts the operator via the CLI
 * to approve any transaction before it gets executed.
 *
 * In real-world production setups this strategy could instead submit the
 * transaction bytes/hash to an external service (a remote TEE, an MPC signing
 * threshold network, or an API key-guarded custodial signer) and wait for the
 * signed response before delegating to ExecuteStrategy.
 */
class CLITransactionApprovalStrategy implements TransactionStrategy {
  private defaultExecute = new ExecuteStrategy();

  private askConfirmation(promptMsg: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(promptMsg, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });
  }

  async handle(
    tx: Transaction,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => string,
  ) {
    if (!context.accountId) {
      throw new Error('Account ID is required in context for transaction execution');
    }

    if (!tx.transactionId) {
      tx.setTransactionId(TransactionId.generate(context.accountId));
    }
    tx.freezeWith(client);

    console.log('\n========================================');
    console.log('PENDING TRANSACTION APPROVAL');
    console.log(`Transaction ID: ${tx.transactionId?.toString()}`);
    console.log('========================================');

    const approved = await this.askConfirmation('Do you want to sign and execute this transaction? (y/N): ');
    if (!approved) {
      throw new Error('Transaction rejected by user (Human-in-the-Loop check failed)');
    }

    console.log('Executing transaction...');
    return this.defaultExecute.handle(tx, client, context, postProcess);
  }
}

function validateEnv() {
  const required = ['ACCOUNT_ID', 'PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
    // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
  );

  const hederaAgentToolkit = new HederaAIToolkit({
    client,
    configuration: {
      context: {
        mode: AgentMode.CUSTOM_EXECUTE_TX,
        accountId: process.env.ACCOUNT_ID!,
        transactionStrategy: new CLITransactionApprovalStrategy(),
      },
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
    },
  });

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: hederaAgentToolkit.middleware(),
  });

  console.log('Hedera Agent CLI Chatbot with Custom Signing Strategy — type "exit" to quit');

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

    conversationHistory.push({ role: 'user', content: userInput });

    try {
      const response = await generateText({
        model,
        messages: conversationHistory,
        tools: hederaAgentToolkit.getTools(),
        stopWhen: stepCountIs(2),
      });

      conversationHistory.push({ role: 'assistant', content: response.text });
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
