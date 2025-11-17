import { Client } from '@hashgraph/sdk';
import {
  HederaLangchainToolkit,
} from '@/langchain';
import { ResponseParserService } from 'hedera-agent-kit';
import {
  TOOLKIT_OPTIONS,
  DEFAULT_LLM_OPTIONS,
  getProviderApiKeyMap,
  SYSTEM_PROMPT,
} from './langchain-test-config';

import { LLMFactory, type LlmOptions, LLMProvider } from './llm-factory';

import { getOperatorClientForTests } from './client-setup';
import type { LangchainTestOptions } from './langchain-test-config';
import { createAgent, ReactAgent } from 'langchain';
import { AgentMode } from '@/shared';

export interface LangchainTestSetup {
  client: Client;
  agent: ReactAgent;
  toolkit: HederaLangchainToolkit;
  responseParser: ResponseParserService;
  cleanup: () => void;
}

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

  const tools = toolkit.getTools();

  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: SYSTEM_PROMPT || `
      You are a Hedera blockchain assistant.
      You have access to tools for blockchain operations.
      Correctly extract parameters and call the right Hedera tools.
    `,
  });


  const responseParser = new ResponseParserService(tools);

  const cleanup = () => client.close();

  return {
    client,
    agent,
    toolkit,
    responseParser,
    cleanup,
  };
}
