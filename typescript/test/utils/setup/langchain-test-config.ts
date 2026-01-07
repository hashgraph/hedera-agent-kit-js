import { AgentMode } from '@/shared';
import type { Plugin } from '@/shared/plugin';
import { LLMProvider, type LlmOptions } from './llm-factory';
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
  coreTransactionQueryPlugin,
  coreTransactionQueryPluginToolNames,
  coreMiscQueriesPlugin,
  coreMiscQueriesPluginsToolNames,
  coreEVMPlugin,
  coreEVMPluginToolNames,
  coreEVMQueryPlugin,
  coreEVMQueryPluginToolNames,
} from '@/plugins';

/**
 * Balance tiers for test account funding.
 * These are defined in USD and should be converted to HBAR at runtime
 * using UsdToHbarService.usdToHbar().
 *
 * Tiers:
 * - MINIMAL:  $0.50 - Basic operations (single transfer, simple query)
 * - STANDARD: $5.00 - Most common test scenarios (token operations, multiple transfers)
 * - ELEVATED: $10.00 - Complex operations (NFT minting, multiple token operations)
 * - MAXIMUM:  $20.00 - Heavy operations (contract deployments, extensive token operations)
 */
export const BALANCE_TIERS = {
  /** $0.50 - Basic operations (single transfer, simple query) */
  MINIMAL: 0.5,
  /** $5.00 - Most common test scenarios (token operations, multiple transfers) */
  STANDARD: 5,
  /** $10.00 - Complex operations (NFT minting, multiple token operations) */
  ELEVATED: 10,
  /** $20.00 - Heavy operations (contract deployments, extensive token operations) */
  MAXIMUM: 20,
} as const;

export type BalanceTier = (typeof BALANCE_TIERS)[keyof typeof BALANCE_TIERS];

/**
 * Common test toolkit options type used by langchain test setup.
 */
export interface LangchainTestOptions {
  tools: string[];
  plugins: Plugin[];
  agentMode: AgentMode;
}

const {
  TRANSFER_HBAR_TOOL,
  CREATE_ACCOUNT_TOOL,
  DELETE_ACCOUNT_TOOL,
  UPDATE_ACCOUNT_TOOL,
  SIGN_SCHEDULE_TRANSACTION_TOOL,
  SCHEDULE_DELETE_TOOL,
  APPROVE_HBAR_ALLOWANCE_TOOL,
  DELETE_HBAR_ALLOWANCE_TOOL,
  APPROVE_TOKEN_ALLOWANCE_TOOL,
  TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
  DELETE_TOKEN_ALLOWANCE_TOOL,
} = coreAccountPluginToolNames;
const {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
  UPDATE_TOKEN_TOOL,
  DISSOCIATE_TOKEN_TOOL,
  ASSOCIATE_TOKEN_TOOL,
  APPROVE_NFT_ALLOWANCE_TOOL,
  TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
  TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
  TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
  DELETE_NFT_ALLOWANCE_TOOL,
} = coreTokenPluginToolNames;
const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL, DELETE_TOPIC_TOOL, UPDATE_TOPIC_TOOL } =
  coreConsensusPluginToolNames;
const {
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
} = coreAccountQueryPluginToolNames;

const { GET_TOPIC_MESSAGES_QUERY_TOOL, GET_TOPIC_INFO_QUERY_TOOL } =
  coreConsensusQueryPluginToolNames;
const { GET_TOKEN_INFO_QUERY_TOOL, GET_PENDING_AIRDROP_TOOL } = coreTokenQueryPluginToolNames;
const { GET_CONTRACT_INFO_QUERY_TOOL } = coreEVMQueryPluginToolNames;
const { GET_TRANSACTION_RECORD_QUERY_TOOL } = coreTransactionQueryPluginToolNames;
const { GET_EXCHANGE_RATE_TOOL } = coreMiscQueriesPluginsToolNames;
const {
  TRANSFER_ERC721_TOOL,
  MINT_ERC721_TOOL,
  CREATE_ERC20_TOOL,
  TRANSFER_ERC20_TOOL,
  CREATE_ERC721_TOOL,
} = coreEVMPluginToolNames;

/**
 * Utility to return a mapping of LLM providers to their API keys from environment variables.
 * Exported so callers can centralize env-key retrieval logic here.
 */
export function getProviderApiKeyMap(): Record<LLMProvider, string | undefined> {
  return {
    [LLMProvider.OPENAI]: process.env.OPENAI_API_KEY,
    [LLMProvider.ANTHROPIC]: process.env.ANTHROPIC_API_KEY,
    [LLMProvider.GROQ]: process.env.GROQ_API_KEY,
  };
}

// Default toolkit configuration - should include all possible actions
export const TOOLKIT_OPTIONS: LangchainTestOptions = {
  tools: [
    TRANSFER_HBAR_TOOL,
    CREATE_FUNGIBLE_TOKEN_TOOL,
    CREATE_TOPIC_TOOL,
    SUBMIT_TOPIC_MESSAGE_TOOL,
    DELETE_TOPIC_TOOL,
    GET_HBAR_BALANCE_QUERY_TOOL,
    CREATE_NON_FUNGIBLE_TOKEN_TOOL,
    CREATE_ACCOUNT_TOOL,
    DELETE_ACCOUNT_TOOL,
    UPDATE_ACCOUNT_TOOL,
    AIRDROP_FUNGIBLE_TOKEN_TOOL,
    MINT_FUNGIBLE_TOKEN_TOOL,
    MINT_NON_FUNGIBLE_TOKEN_TOOL,
    ASSOCIATE_TOKEN_TOOL,
    GET_ACCOUNT_QUERY_TOOL,
    GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
    GET_TOPIC_MESSAGES_QUERY_TOOL,
    GET_TOKEN_INFO_QUERY_TOOL,
    GET_TRANSACTION_RECORD_QUERY_TOOL,
    GET_EXCHANGE_RATE_TOOL,
    SIGN_SCHEDULE_TRANSACTION_TOOL,
    GET_CONTRACT_INFO_QUERY_TOOL,
    TRANSFER_ERC721_TOOL,
    MINT_ERC721_TOOL,
    CREATE_ERC20_TOOL,
    TRANSFER_ERC20_TOOL,
    CREATE_ERC721_TOOL,
    UPDATE_TOKEN_TOOL,
    GET_PENDING_AIRDROP_TOOL,
    DISSOCIATE_TOKEN_TOOL,
    SCHEDULE_DELETE_TOOL,
    GET_TOPIC_INFO_QUERY_TOOL,
    UPDATE_TOPIC_TOOL,
    APPROVE_HBAR_ALLOWANCE_TOOL,
    APPROVE_TOKEN_ALLOWANCE_TOOL,
    DELETE_HBAR_ALLOWANCE_TOOL,
    APPROVE_NFT_ALLOWANCE_TOOL,
    DELETE_TOKEN_ALLOWANCE_TOOL,
    TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
    TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
    TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
    DELETE_NFT_ALLOWANCE_TOOL,
    TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
  ],
  plugins: [
    coreAccountPlugin,
    coreAccountQueryPlugin,
    coreConsensusQueryPlugin,
    coreTokenQueryPlugin,
    coreTokenPlugin,
    coreConsensusPlugin,
    coreTransactionQueryPlugin,
    coreMiscQueriesPlugin,
    coreEVMPlugin,
    coreEVMQueryPlugin,
  ],
  agentMode: AgentMode.AUTONOMOUS,
};

export const DEFAULT_LLM_OPTIONS: LlmOptions = {
  provider: LLMProvider.OPENAI,
  model: 'gpt-4o-mini',
};

export const SYSTEM_PROMPT = `You are a Hedera blockchain assistant. You have access to tools for blockchain operations.
        When a user asks to transfer HBAR, use the transfer_hbar_tool with the correct parameters.
        Extract the amount and recipient account ID from the user's request.
        Always use the exact tool name and parameter structure expected.`;
