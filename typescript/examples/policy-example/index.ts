import {
  AgentMode,
  coreAccountPluginToolNames,
  coreTokenPluginToolNames,
  HederaLangchainToolkit,
  ImmutabilityPolicy,
  NoInfiniteSupplyPolicy,
  RequiredMemoPolicy,
  MaxHbarTransferPolicy,
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
  } = coreAccountPluginToolNames;
  const { CREATE_FUNGIBLE_TOKEN_TOOL, UPDATE_TOKEN_TOOL } = coreTokenPluginToolNames;

  // Prepare Hedera toolkit with strict policies
  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [
        // Core tools relevant to policy usage
        TRANSFER_HBAR_TOOL,
        APPROVE_HBAR_ALLOWANCE_TOOL,
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        UPDATE_ACCOUNT_TOOL,
        CREATE_FUNGIBLE_TOKEN_TOOL,
        UPDATE_TOKEN_TOOL,
      ],
      plugins: [],
      context: {
        mode: AgentMode.AUTONOMOUS,
        policies: [
          new RequiredMemoPolicy(), // FIXME: currently only works for transfer_hbar_tool
          // new MaxHbarTransferPolicy(5), // Limit 5 HBAR
          // new NoInfiniteSupplyPolicy(),
          // new ImmutabilityPolicy({
          //   accounts: [process.env.ACCOUNT_ID!], // Make the operator account immutable
          // }),
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

  console.log('Hedera Policy Agent Demo');
  console.log(
    'policies: RequiredMemo, MaxHbarTransfer(5), NoInfiniteSupply, Immutability(Operator)',
  );
  console.log('Try asking the agent to:');
  console.log('1. "Transfer 1 HBAR to 0.0.12345" (Should fail due to missing memo)');
  console.log('2. "Transfer 1 HBAR to 0.0.12345 with memo "Test"" (Should succeed)');
  // console.log('2. "Transfer 10 HBAR to 0.0.12345 with memo Test" (Should fail due to max amount)');
  // console.log('3. "Transfer 1 HBAR to 0.0.12345 with memo Valid" (Should succeed)');
  // console.log('4. "Create a token with infinite supply" (Should fail)');
  // console.log('5. "Update my account memo" (Should fail due to immutability)');
  console.log('---------------------------------------------------------');

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
