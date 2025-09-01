import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getTokenInfoQuery, {
  GET_TOKEN_INFO_QUERY_TOOL,
} from '@/plugins/core-token-query-plugin/tools/queries/get-token-info-query';

export const coreTokenQueryPlugin: Plugin = {
  name: 'core-token-query-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera Token Service queries',
  tools: (context: Context) => {
    return [
      getTokenInfoQuery(context),
    ];
  },
};

export const coreTokenQueryPluginToolNames = {
  GET_TOKEN_INFO_QUERY_TOOL,
} as const;

export default { coreTokenQueryPlugin, coreTokenQueryPluginToolNames };