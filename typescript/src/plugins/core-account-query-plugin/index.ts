import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getHbarBalanceQuery, {
  GET_HBAR_BALANCE_QUERY_TOOL,
} from '@/plugins/core-account-query-plugin/tools/queries/get-hbar-balance-query';
import getAccountQuery, {
  GET_ACCOUNT_QUERY_TOOL,
} from '@/plugins/core-account-query-plugin/tools/queries/get-account-query';
import getAccountTokenBalancesQuery, {
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
} from '@/plugins/core-account-query-plugin/tools/queries/get-account-token-balances-query';

export const coreAccountQueryPlugin: Plugin = {
  name: 'core-account-query-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera Account Service queries',
  tools: (context: Context) => {
    return [
      getHbarBalanceQuery(context),
      getAccountQuery(context),
      getAccountTokenBalancesQuery(context),
    ];
  },
};

export const coreAccountQueryPluginToolNames = {
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
} as const;

export default { coreAccountQueryPlugin, coreAccountQueryPluginToolNames };
