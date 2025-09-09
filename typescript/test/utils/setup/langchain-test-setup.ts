import { Client } from '@hashgraph/sdk';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { AgentMode } from '@/shared';
import type { Plugin } from '@/shared/plugin';
import { LLMFactory, type LlmOptions, LLMProvider } from './llm-factory';
import {
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  coreAccountQueryPlugin,
  coreAccountQueryPluginToolNames,
  coreTokenQueryPlugin,
  coreTokenQueryPluginToolNames,
  coreConsensusQueryPlugin,
  coreConsensusQueryPluginToolNames,
  coreTransactionQueryPluginToolNames,
  coreTransactionQueryPlugin,
  coreEVMQueryPluginToolNames,
  coreEVMQueryPlugin,
} from '@/plugins';
import { getOperatorClientForTests } from './client-setup';

export interface LangchainTestSetup {
  client: Client;
  agentExecutor: AgentExecutor;
  toolkit: HederaLangchainToolkit;
  cleanup: () => void;
}

export interface LangchainTestOptions {
  tools: string[];
  plugins: Plugin[];
  agentMode: AgentMode;
}

const { TRANSFER_HBAR_TOOL, CREATE_ACCOUNT_TOOL, DELETE_ACCOUNT_TOOL, UPDATE_ACCOUNT_TOOL } =
  coreAccountPluginToolNames;
const {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} = coreTokenPluginToolNames;
const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL } = coreConsensusPluginToolNames;
const {
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
} = coreAccountQueryPluginToolNames;

const { GET_TOPIC_MESSAGES_QUERY_TOOL } = coreConsensusQueryPluginToolNames;
const { GET_TOKEN_INFO_QUERY_TOOL } = coreTokenQueryPluginToolNames;

const { GET_TRANSACTION_RECORD_QUERY_TOOL } = coreTransactionQueryPluginToolNames;
const { GET_CONTRACT_INFO_QUERY_TOOL } = coreEVMQueryPluginToolNames;

// Default toolkit configuration - should include all possible actions
const TOOLKIT_OPTIONS: LangchainTestOptions = {
  tools: [
    TRANSFER_HBAR_TOOL,
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_TOPIC_TOOL,
    SUBMIT_TOPIC_MESSAGE_TOOL,
    GET_HBAR_BALANCE_QUERY_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    CREATE_ACCOUNT_TOOL,
    DELETE_ACCOUNT_TOOL,
    UPDATE_ACCOUNT_TOOL,
    AIRDROP_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
    MINT_NON_FUNGIBLE_TOKEN_TOOL,
    GET_ACCOUNT_QUERY_TOOL,
    GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    GET_TOPIC_MESSAGES_QUERY_TOOL,
    GET_TOKEN_INFO_QUERY_TOOL,
    GET_TRANSACTION_RECORD_QUERY_TOOL,
    GET_CONTRACT_INFO_QUERY_TOOL,
  ],
  plugins: [
    coreAccountPlugin,
    coreAccountQueryPlugin,
    coreConsensusQueryPlugin,
    coreTokenQueryPlugin,
    coreTokenPlugin,
    coreConsensusPlugin,
    coreTransactionQueryPlugin,
    coreEVMQueryPlugin,
  ],
  agentMode: AgentMode.AUTONOMOUS,
};

const DEFAULT_LLM_OPTIONS: LlmOptions = {
  provider: LLMProvider.OPENAI,
  temperature: 0,
  maxIterations: 1,
  model: 'gpt-4o-mini',
  systemPrompt: `You are a Hedera blockchain assistant. You have access to tools for blockchain operations.
        When a user asks to transfer HBAR, use the transfer_hbar_tool with the correct parameters.
        Extract the amount and recipient account ID from the user's request.
        Always use the exact tool name and parameter structure expected.`,
};

/**
 * Creates a test setup for LangChain using the specified plugins and LLM options.
 *
 * @param {LangchainTestOptions} [toolkitOptions=TOOLKIT_OPTIONS] - Options for configuring the LangChain plugins and tools.
 * @param {LlmOptions} [llmOptions=DEFAULT_LLM_OPTIONS] - Options for configuring the large language model (LLM), including provider and API key.
 * @param {Client} [customClient] - Optional custom Hedera client instance. If not provided, a default test client will be created from test environment variables
 * @returns {Promise<LangchainTestSetup>} A promise that resolves to the test setup containing client, agent executor, toolkit, and cleanup function.
 */
export async function createLangchainTestSetup(
  toolkitOptions: LangchainTestOptions = TOOLKIT_OPTIONS,
  llmOptions: LlmOptions = DEFAULT_LLM_OPTIONS,
  customClient: Client | undefined = undefined,
): Promise<LangchainTestSetup> {
  const client = customClient || getOperatorClientForTests();
  const operatorAccountId = client.operatorAccountId!;

  // Resolve provider from env (set by GitHub Actions matrix), or fallback to llmOptions
  const provider = (process.env.E2E_LLM_PROVIDER || llmOptions.provider) as LLMProvider;

  // Resolve API key from env
  const providerApiKeyMap: Record<string, string | undefined> = {
    [LLMProvider.OPENAI]: process.env.OPENAI_API_KEY,
    [LLMProvider.ANTHROPIC]: process.env.ANTHROPIC_API_KEY,
    [LLMProvider.GROQ]: process.env.GROQ_API_KEY,
  };

  const apiKey = llmOptions.apiKey || providerApiKeyMap[provider];
  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const resolvedLlmOptions: LlmOptions = {
    ...llmOptions,
    provider,
    apiKey,
  };

  // Create an LLM instance
  const llm = LLMFactory.createLLM(resolvedLlmOptions);

  // Prepare Hedera toolkit with specified tools and plugins
  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: toolkitOptions.tools,
      plugins: toolkitOptions.plugins,
      context: {
        mode: toolkitOptions.agentMode || AgentMode.AUTONOMOUS,
        accountId: operatorAccountId.toString(),
      },
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', resolvedLlmOptions.systemPrompt!],
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
    returnIntermediateSteps: true,
    maxIterations: resolvedLlmOptions.maxIterations ?? 1,
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
