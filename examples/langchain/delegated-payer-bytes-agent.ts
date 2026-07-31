import { AgentMode, TransactionStrategy, ReturnBytesStrategyResult, Context } from '@hashgraph/hedera-agent-kit';
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
import { HederaLangchainToolkit, ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from '@langchain/classic/agents';
import { BufferMemory } from '@langchain/classic/memory';
import { Client, PrivateKey, Transaction, TransactionId } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * A custom strategy that assigns the user's account as the transaction fee payer,
 * freezes the transaction with the agent client, and returns unsigned bytes.
 *
 * The caller is then responsible for:
 *   1. Re-hydrating the transaction from bytes via Transaction.fromBytes(bytes).
 *   2. Signing with the user's private key.
 *   3. Submitting to the network using a client that has the user's account as operator.
 *
 * This pattern is useful when an AI agent needs to prepare transactions on behalf
 * of a user without ever holding the user's private key — e.g., in a dApp backend,
 * TEE, or multi-party signing flow.
 */
class DelegatedPayerBytesStrategy implements TransactionStrategy<ReturnBytesStrategyResult> {
  private readonly userAccountId: string;

  constructor(userAccountId: string) {
    this.userAccountId = userAccountId;
  }

  async handle(tx: Transaction, client: Client, _context: Context): Promise<ReturnBytesStrategyResult> {
    tx.setTransactionId(TransactionId.generate(this.userAccountId));
    tx.freezeWith(client);

    const bytes = tx.toBytes();

    console.log('\n========================================');
    console.log('Unsigned transaction bytes ready for signing:');
    console.log(`  Fee payer: ${this.userAccountId}`);
    console.log(`  Bytes (base64): ${Buffer.from(bytes).toString('base64').substring(0, 60)}...`);
    console.log('========================================\n');

    return { bytes, status: 'SUCCESS' };
  }
}

function validateEnv() {
  const required = ['ACCOUNT_ID', 'PRIVATE_KEY', 'USER_ACCOUNT_ID', 'USER_PRIVATE_KEY', 'OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error(
      'ACCOUNT_ID / PRIVATE_KEY — the agent (service) account that builds transactions.\n' +
      'USER_ACCOUNT_ID / USER_PRIVATE_KEY — the user account that pays fees and signs.\n' +
      'Copy .env.example to .env and fill in your keys.',
    );
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });

  // Agent (service) account: used only to freeze transactions, never to execute them.
  const agentAccountId = process.env.ACCOUNT_ID!;
  const agentPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!);

  // User account: becomes the fee payer in the TransactionId and must sign the bytes.
  const userAccountId = process.env.USER_ACCOUNT_ID!;
  const userPrivateKey = PrivateKey.fromStringECDSA(process.env.USER_PRIVATE_KEY!);

  // Agent client — connects to testnet; used for freeze only.
  const agentClient = Client.forTestnet().setOperator(agentAccountId, agentPrivateKey);

  // User client — used to sign and submit the bytes after out-of-band signing.
  const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

  const hederaAgentToolkit = new HederaLangchainToolkit({
    client: agentClient,
    configuration: {
      context: {
        mode: AgentMode.CUSTOM_RETURN_BYTES,
        accountId: agentAccountId,
        transactionStrategy: new DelegatedPayerBytesStrategy(userAccountId),
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
      tools: [],
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  const tools = hederaAgentToolkit.getTools();
  const responseParser = new ResponseParserService(tools);

  const agent = createToolCallingAgent({ llm, tools, prompt });

  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    inputKey: 'input',
    outputKey: 'output',
    returnMessages: true,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
  });

  console.log('Hedera Agent — Delegated Payer (CUSTOM_RETURN_BYTES) — type "exit" to quit');

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
      const response = await agentExecutor.invoke({ input: userInput });
      console.log(`AI: ${response?.output ?? response}`);

      const messages = response.intermediateSteps?.map((step: any, index: number) => ({
        type: 'tool',
        id: step.action?.toolCallId || `step-${index}`,
        name: step.action?.tool,
        content: step.observation,
        tool_call_id: step.action?.toolCallId,
      })) || [];

      const parsedTools = responseParser.parseNewToolMessages({ messages });
      const bytes = parsedTools?.[0]?.parsedData?.raw?.bytes;

      if (bytes) {
        // Re-hydrate, sign with the user's key, and submit using the user's client.
        // In a real dApp this signing step happens in the user's wallet (e.g. HashPack).
        const tx = Transaction.fromBytes(bytes);
        await tx.sign(userPrivateKey);
        const submitted = await tx.execute(userClient);
        const receipt = await submitted.getReceipt(userClient);
        console.log(`Transaction status: ${receipt.status.toString()}`);
        console.log(`Transaction ID:     ${submitted.transactionId?.toString()}`);
      }
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
