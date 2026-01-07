import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getHbarBalanceQuery, {
  GET_HBAR_BALANCE_QUERY_TOOL,
} from '@/plugins/core-queries-plugin/tools/queries/get-hbar-balance-query';
import getAccountQuery, {
  GET_ACCOUNT_QUERY_TOOL,
} from '@/plugins/core-queries-plugin/tools/queries/get-account-query';
import getAccountTokenBalancesQuery, {
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
} from '@/plugins/core-queries-plugin/tools/queries/get-account-token-balances-query';
import getTopicMessagesQuery, {
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} from '@/plugins/core-queries-plugin/tools/queries/get-topic-messages-query';
import getTokenInfoQuery, {
  GET_TOKEN_INFO_QUERY_TOOL,
} from '@/plugins/core-queries-plugin/tools/queries/get-token-info-query';

/**
 * @deprecated This plugin is deprecated. Use the specific query plugins instead:
 * - coreAccountQueryPlugin for account-related queries
 * - coreTokenQueryPlugin for token-related queries
 * - coreConsensusQueryPlugin for consensus-related queries
 * This export will be removed in a future version.
 */
export const coreQueriesPlugin: Plugin = {
  name: 'core-queries-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Queries Service (DEPRECATED)',
  tools: (context: Context) => {
    return [
      getHbarBalanceQuery(context),
      getAccountQuery(context),
      getAccountTokenBalancesQuery(context),
      getTopicMessagesQuery(context),
      getTokenInfoQuery(context),
    ];
  },
};

/**
 * @deprecated Use the specific query plugin tool names instead:
 * - coreAccountQueryPluginToolNames for account-related query tools
 * - coreTokenQueryPluginToolNames for token-related query tools
 * - coreConsensusQueryPluginToolNames for consensus-related query tools
 * This export will be removed in a future version.
 */
export const coreQueriesPluginToolNames = {
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
  GET_TOKEN_INFO_QUERY_TOOL,
} as const;

export default { coreQueriesPlugin, coreQueriesPluginToolNames };
