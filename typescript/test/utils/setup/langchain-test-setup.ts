import { Client } from '@hashgraph/sdk';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { AgentMode } from '@/shared';
import { LLMFactory, type LlmOptions, LLMProvider } from './llm-factory';
import { getOperatorClientForTests } from './client-setup';
import type { LangchainTestOptions } from './langchain-test-config';
import {
  TOOLKIT_OPTIONS,
  DEFAULT_LLM_OPTIONS,
  getProviderApiKeyMap,
} from './langchain-test-config';

export interface LangchainTestSetup {
  client: Client;
  agentExecutor: AgentExecutor;
  toolkit: HederaLangchainToolkit;
  cleanup: () => void;
}

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
  const client = customClient || getOperatorClientForTests();
  const operatorAccountId = client.operatorAccountId!;

  // Resolve final LLM options (provider, model, apiKey)
  const provider: LLMProvider =
    llmOptions?.provider ||
    (process.env.E2E_LLM_PROVIDER as LLMProvider) ||
    DEFAULT_LLM_OPTIONS.provider;

  const model: string | undefined =
    llmOptions?.model || process.env.E2E_LLM_MODEL || DEFAULT_LLM_OPTIONS.model;

  const providerApiKeyMap = getProviderApiKeyMap();
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
