import {
  AgentMode,
  coreAccountPluginToolNames,
  coreTokenPluginToolNames,
  HederaLangchainToolkit,
  RequiredMemoPolicy,
  MaxHbarTransferPolicy,
  NoInfiniteSupplyPolicy,
  ImmutabilityPolicy,
  TokenAllowlistPolicy,
  ResponseParserService,
} from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { StructuredToolInterface } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

dotenv.config();

async function bootstrap(): Promise<void> {
  // Hedera client setup (Testnet by default)
  const client = Client.forTestnet().setOperator(
    process.env.ACCOUNT_ID!,
    PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  );

  // all the available tools
  const {
    TRANSFER_HBAR_TOOL,
    APPROVE_HBAR_ALLOWANCE_TOOL,
    TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
    UPDATE_ACCOUNT_TOOL,
    DELETE_ACCOUNT_TOOL,
  } = coreAccountPluginToolNames;
  const {
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    UPDATE_TOKEN_TOOL,
    TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
    ASSOCIATE_TOKEN_TOOL,
  } = coreTokenPluginToolNames;

  // Example token IDs for the token allowlist policy
  const allowedTokenIds = ['0.0.123456', '0.0.789012'];

  // Prepare Hedera toolkit with strict policies
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [
        // Core account tools
        TRANSFER_HBAR_TOOL,
        APPROVE_HBAR_ALLOWANCE_TOOL,
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        UPDATE_ACCOUNT_TOOL,
        DELETE_ACCOUNT_TOOL,
        // Core token tools
        CREATE_FUNGIBLE_TOKEN_TOOL,
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        UPDATE_TOKEN_TOOL,
        TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
        MINT_FUNGIBLE_TOKEN_TOOL,
        ASSOCIATE_TOKEN_TOOL,
      ],
      plugins: [],
      context: {
        mode: AgentMode.AUTONOMOUS,
        policies: [
          // 1. RequiredMemoPolicy - Ensures all transactions have a memo
          new RequiredMemoPolicy(),

          // 2. MaxHbarTransferPolicy - Limits HBAR transfers to a maximum amount
          new MaxHbarTransferPolicy(5), // Limit 5 HBAR per transfer

          // 3. NoInfiniteSupplyPolicy - Prevents creating tokens with infinite supply
          new NoInfiniteSupplyPolicy(),

          // 4. ImmutabilityPolicy - Prevents modifying specified accounts/tokens
          new ImmutabilityPolicy({
            accounts: [process.env.ACCOUNT_ID!], // Make the operator account immutable
            tokens: [], // Add token IDs to make them immutable
          }),

          // 5. TokenAllowlistPolicy - Only allows interactions with specified tokens
          new TokenAllowlistPolicy(allowedTokenIds),
        ],
      },
    },
  });

  // Fetch tools from a toolkit
  const tools: StructuredToolInterface[] = hederaAgentToolkit.getTools();

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = createAgent({
    model: llm,
    tools: tools,
    systemPrompt:
      'You are a helpful assistant with access to Hedera blockchain tools. You must always adhere to the policies enforced by the tools.',
    checkpointer: new MemorySaver(),
  });

  const responseParsingService = new ResponseParserService(hederaAgentToolkit.getTools());

  console.log('==========================================================');
  console.log('              Hedera Policy Agent Demo');
  console.log('==========================================================');
  console.log('\nActive Policies:');
  console.log('  1. RequiredMemoPolicy    - All transactions must have a memo');
  console.log('  2. MaxHbarTransferPolicy - Max 5 HBAR per transfer');
  console.log('  3. NoInfiniteSupplyPolicy - No tokens with infinite supply');
  console.log(`  4. ImmutabilityPolicy    - Account ${process.env.ACCOUNT_ID} is protected`);
  console.log(`  5. TokenAllowlistPolicy  - Only tokens: ${allowedTokenIds.join(', ')}`);
  console.log('\n----------------------------------------------------------');
  console.log('Try asking the agent to:');
  console.log('  - "Transfer 1 HBAR to 0.0.12345" (Fails: no memo)');
  console.log('  - "Transfer 1 HBAR to 0.0.12345 with memo Test" (Succeeds)');
  console.log('  - "Transfer 10 HBAR to 0.0.12345 with memo Test" (Fails: exceeds limit)');
  console.log('  - "Create a token with infinite supply" (Fails: infinite not allowed)');
  console.log('  - "Update my account memo" (Fails: account is immutable)');
  console.log('  - "Transfer token 0.0.999999 to 0.0.12345" (Fails: token not in allowlist)');
  console.log('----------------------------------------------------------\n');

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
      const response = await agent.invoke(
        { messages: [{ role: 'user', content: userInput }] },
        { configurable: { thread_id: '1' } },
      );

      const parsedToolData = responseParsingService.parseNewToolMessages(response);

      const toolCall = parsedToolData[0];

      // 1. Handle case when NO tool was called (simple chat)
      if (!toolCall) {
        console.log(
          `AI: ${response.messages[response.messages.length - 1].content ?? JSON.stringify(response)}`,
        );
      } else {
        // 2. Handle Tool calls
        console.log(
          `\nAI: ${response.messages[response.messages.length - 1].content ?? JSON.stringify(response)}`,
        );
        console.log('\n--- Tool Execution ---');
        console.log('Human Message:', toolCall.parsedData.humanMessage);
        console.log('Raw Result:', JSON.stringify(toolCall.parsedData, null, 2));
      }
    } catch (err: any) {
      console.error('Error:', err.message || err);
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
