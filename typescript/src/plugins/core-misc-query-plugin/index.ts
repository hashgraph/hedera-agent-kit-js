import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getExchangeRateQuery, {
  GET_EXCHANGE_RATE_TOOL,
} from '@/plugins/core-misc-query-plugin/tools/queries/get-exchange-rate-query';

export const coreMiscQueriesPlugin: Plugin = {
  name: 'core-misc-queries-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera Misc Queries',
  tools: (context: Context) => {
    return [getExchangeRateQuery(context)];
  },
};

export const coreMiscQueriesPluginsToolNames = {
  GET_EXCHANGE_RATE_TOOL,
} as const;

export default { coreMiscQueriesPluginsToolNames };
