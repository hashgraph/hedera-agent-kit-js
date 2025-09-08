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
} from '@/plugins';
import { getClientForTests } from './client-setup';

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
  ],
  plugins: [
    coreAccountPlugin,
    coreAccountQueryPlugin,
    coreConsensusQueryPlugin,
    coreTokenQueryPlugin,
    coreTokenPlugin,
    coreConsensusPlugin,
    coreTransactionQueryPlugin,
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
 * This function initializes a complete testing environment with Hedera client, LLM agent,
 * and all necessary tools for blockchain operations testing.
 *
 * @param {LangchainTestOptions} [toolkitOptions=TOOLKIT_OPTIONS] - Configuration for tools, plugins, and agent mode
 * @param {Partial<LlmOptions>} [llmOptions] - LLM configuration (provider, model, temperature, etc.)
 * @param {Client} [customClient] - Optional custom Hedera client instance
 * @returns {Promise<LangchainTestSetup>} Complete test setup with client, agent executor, toolkit, and cleanup function
 * @throws {Error} Throws an error if required API keys are missing for the specified LLM provider
 * @example
 * ```typescript
 * const setup = await createLangchainTestSetup({
 *   tools: ['TRANSFER_HBAR_TOOL', 'CREATE_ACCOUNT_TOOL'],
 *   plugins: [coreAccountPlugin],
 *   agentMode: AgentMode.AUTONOMOUS
 * });
 *
 * try {
 *   const result = await setup.agentExecutor.invoke({
 *     input: "Transfer 1 HBAR to 0.0.12345"
 *   });
 *   console.log(result);
 * } finally {
 *   setup.cleanup();
 * }
 * ```
 */
export async function createLangchainTestSetup(
  toolkitOptions: LangchainTestOptions = TOOLKIT_OPTIONS,
  llmOptions?: Partial<LlmOptions>,
  customClient?: Client,
): Promise<LangchainTestSetup> {
  const client = customClient || getClientForTests();
  const operatorAccountId = client.operatorAccountId!;

  // Resolve final LLM options (provider, model, apiKey)
  const provider: LLMProvider =
    llmOptions?.provider ||
    (process.env.E2E_LLM_PROVIDER as LLMProvider) ||
    DEFAULT_LLM_OPTIONS.provider;

  const model: string | undefined =
    llmOptions?.model || process.env.E2E_LLM_MODEL || DEFAULT_LLM_OPTIONS.model;

  const providerApiKeyMap: Record<string, string | undefined> = {
    [LLMProvider.OPENAI]: process.env.OPENAI_API_KEY,
    [LLMProvider.ANTHROPIC]: process.env.ANTHROPIC_API_KEY,
    [LLMProvider.GROQ]: process.env.GROQ_API_KEY,
  };
  const apiKey = llmOptions?.apiKey || providerApiKeyMap[provider];
  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const resolvedLlmOptions: LlmOptions = {
    ...DEFAULT_LLM_OPTIONS, // OPENAI is the default provider
    ...llmOptions,
    provider,
    model,
    apiKey,
  };

  // Create LLM
  const llm = LLMFactory.createLLM(resolvedLlmOptions);

  // Prepare toolkit
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

  // Create prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', resolvedLlmOptions.systemPrompt!],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);

  // Create agent and executor
  const tools = toolkit.getTools();
  const agent = createToolCallingAgent({ llm, tools, prompt });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    returnIntermediateSteps: true,
    maxIterations: resolvedLlmOptions.maxIterations ?? 1,
  });

  // Cleanup function
  const cleanup = () => client.close();

  return { client, agentExecutor, toolkit, cleanup };
}
