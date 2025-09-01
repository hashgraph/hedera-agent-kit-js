import { Client } from '@hashgraph/sdk';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { AgentMode } from '@/shared';
import type { Plugin } from '@/shared/plugin';
import { LLMFactory, type LlmOptions } from './llm-factory';
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
} from '@/plugins';
import { getClientForTests } from './client-setup';

const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;
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

// Default options for creating a test setup - should include all possible actions
const PLUGIN_OPTIONS: LangchainTestOptions = {
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
    GET_TOKEN_INFO_QUERY_TOOL,
  ],
  plugins: [
    coreAccountPlugin,
    coreAccountQueryPlugin,
    coreConsensusQueryPlugin,
    coreTokenQueryPlugin,
    coreTokenPlugin,
    coreConsensusPlugin,
  ],
};

const LLM_OPTIONS: LlmOptions = {
  temperature: 0,
  maxIterations: 1,
  model: 'gpt-4o-mini',
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
  pluginOptions: LangchainTestOptions = PLUGIN_OPTIONS,
  llmOptions: LlmOptions = LLM_OPTIONS,
): Promise<LangchainTestSetup> {
  const client = getClientForTests();
  const operatorAccountId = client.operatorAccountId!;

  // Initialize LLM using factory - either from provided options or environment
  const llm =
    llmOptions.provider || llmOptions.model || llmOptions.apiKey
      ? LLMFactory.createLLM(llmOptions)
      : LLMFactory.fromEnvironment();

  // Prepare Hedera toolkit with specified tools and plugins
  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: pluginOptions.tools,
      plugins: pluginOptions.plugins,
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: operatorAccountId.toString(),
      },
    },
  });

  // Create a prompt template for tool calling
  const systemPrompt =
    llmOptions.systemPrompt ||
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
    maxIterations: llmOptions.maxIterations ?? 1, // Stop after the first tool call
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
