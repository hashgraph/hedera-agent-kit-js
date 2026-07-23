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
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import { Client, PrivateKey, Transaction, TransactionId } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import readline from 'readline';

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

/**
 * A custom transaction signing strategy that prompts the operator
 * via the CLI to approve any transaction before it gets executed.
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

    // 1. Prepare and freeze transaction
    if (!tx.transactionId) {
      tx.setTransactionId(TransactionId.generate(context.accountId));
    }
    tx.freezeWith(client);

    // 2. Prompt operator for manual confirmation (HITL).
    // Note: In real-world production setups, this strategy could instead submit the transaction
    // bytes/hash to an external service (such as a remote TEE, an MPC signing threshold network,
    // or an API key-guarded custodial signer) and wait for the signed response bytes.
    console.log('\n========================================');
    console.log('🛡️  PENDING TRANSACTION APPROVAL');
    console.log(`Transaction ID: ${tx.transactionId?.toString()}`);
    console.log('========================================');

    const approved = await this.askConfirmation('Do you want to sign and execute this transaction? (y/N): ');
    if (!approved) {
      throw new Error('Transaction rejected by user (Human-in-the-Loop check failed)');
    }

    // 3. Delegate to default execution strategy if approved
    console.log('Executing transaction...');
    return this.defaultExecute.handle(tx, client, context, postProcess);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const operatorAccountId = process.env.ACCOUNT_ID!;
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);
  // const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!); // Use this line if you have an ED25519 key

  // Hedera client setup (Testnet by default)
  const agentClient = Client.forTestnet().setOperator(
    operatorAccountId,
    operatorPrivateKey,
  );

  // Prepare Hedera toolkit with AgentMode.CUSTOM_EXECUTE_TX and our custom approval strategy
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client: agentClient,
    configuration: {
      context: {
        mode: AgentMode.CUSTOM_EXECUTE_TX,
        accountId: operatorAccountId,
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
      ], // Load selected plugins
      tools: [], // Load all tools from selected plugins
    },
  });

  // Load the structured chat prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Fetch tools from toolkit
  // cast to any to avoid excessively deep type instantiation caused by zod@3.25
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // In-memory conversation history
  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    inputKey: 'input',
    outputKey: 'output',
    returnMessages: true,
  });

  // Wrap everything in an executor that will maintain memory
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
  });

  console.log('Hedera Agent CLI Chatbot with Custom Signing Strategy — type "exit" to quit');

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

    try {
      const response = await agentExecutor.invoke({ input: userInput });
      console.log(`AI: ${response?.output ?? response}`);
    } catch (err) {
      console.error('Error during invocation:', err);
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
