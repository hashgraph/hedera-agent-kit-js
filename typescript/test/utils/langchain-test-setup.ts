import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { AgentMode } from '@/shared';
import type { Plugin } from '@/shared/plugin';
import {
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreHTSPlugin,
  coreHTSPluginToolNames,
  coreQueriesPlugin,
  coreQueriesPluginToolNames,
} from '@/plugins';

const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;
const {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} = coreHTSPluginToolNames;
const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL } = coreConsensusPluginToolNames;
const {
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} = coreQueriesPluginToolNames;

// Default options for creating a test setup - should include all possible actions
const OPTIONS: LangchainTestOptions = {
  tools: [
    TRANSFER_HBAR_TOOL,
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_TOPIC_TOOL,
    SUBMIT_TOPIC_MESSAGE_TOOL,
    GET_HBAR_BALANCE_QUERY_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    AIRDROP_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
    MINT_NON_FUNGIBLE_TOKEN_TOOL,
    GET_ACCOUNT_QUERY_TOOL,
    GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    GET_TOPIC_MESSAGES_QUERY_TOOL,
  ],
  plugins: [coreAccountPlugin, coreQueriesPlugin, coreHTSPlugin, coreConsensusPlugin],
  systemPrompt: `You are a Hedera blockchain assistant. You have access to tools for blockchain operations.
        When a user asks to transfer HBAR, use the transfer_hbar_tool with the correct parameters.
        Extract the amount and recipient account ID from the user's request.
        Always use the exact tool name and parameter structure expected.`,
};

export interface LangchainTestSetup {
  client: Client;
  agentExecutor: AgentExecutor;
  toolkit: HederaLangchainToolkit;
  cleanup: () => void;
}

export interface LangchainTestOptions {
  tools: string[];
  plugins: Plugin[];
  systemPrompt?: string;
  temperature?: number;
  maxIterations?: number;
  model?: string;
}

export async function createLangchainTestSetup(
  options: LangchainTestOptions = OPTIONS,
): Promise<LangchainTestSetup> {
  // Initialize Hedera client
  const operatorId = process.env.ACCOUNT_ID;
  const operatorKey = process.env.PRIVATE_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error('ACCOUNT_ID and PRIVATE_KEY must be set.');
  }

  const operatorAccountId = AccountId.fromString(operatorId);
  const privateKey = PrivateKey.fromStringDer(operatorKey);
  const client = Client.forTestnet().setOperator(operatorAccountId, privateKey);

  // Initialize OpenAI LLM
  const llm = new ChatOpenAI({
    model: options.model || 'gpt-4o-mini',
    temperature: options.temperature ?? 0, // Make responses more deterministic for testing
  });

  // Prepare Hedera toolkit with specified tools and plugins
  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: options.tools,
      plugins: options.plugins,
      context: {
        mode: AgentMode.RETURN_BYTES, // Use RETURN_BYTES to prevent actual execution
        accountId: operatorAccountId.toString(),
      },
    },
  });

  // Create a prompt template for tool calling
  const systemPrompt =
    options.systemPrompt ||
    `You are a Hedera blockchain assistant. You have access to tools for blockchain operations.
When a user requests blockchain operations, use the appropriate tools with the correct parameters.
Extract all necessary parameters from the user's request.
Always use the exact tool name and parameter structure expected.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Get tools from a toolkit
  const tools = toolkit.getTools();

  // Create the agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // Create an agent executor
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    returnIntermediateSteps: true, // This allows us to see the tool calls
    maxIterations: options.maxIterations ?? 1, // Stop after the first tool call to avoid execution by default
  });

  const cleanup = () => {
    if (client) {
      client.close();
    }
  };

  return {
    client,
    agentExecutor,
    toolkit,
    cleanup,
  };
}
