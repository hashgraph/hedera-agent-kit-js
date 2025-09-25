import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getTokenInfoQuery, {
  GET_TOKEN_INFO_QUERY_TOOL,
} from '@/plugins/core-token-query-plugin/tools/queries/get-token-info-query';
import getPendingAirdropQuery, {
  GET_PENDING_AIRDROP_TOOL,
} from '@/plugins/core-token-query-plugin/tools/queries/get-pending-airdrop-query';

export const coreTokenQueryPlugin: Plugin = {
  name: 'core-token-query-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera Token Service queries',
  tools: (context: Context) => {
    return [getTokenInfoQuery(context), getPendingAirdropQuery(context)];
  },
};

export const coreTokenQueryPluginToolNames = {
  GET_TOKEN_INFO_QUERY_TOOL,
  GET_PENDING_AIRDROP_TOOL,
} as const;

export default { coreTokenQueryPlugin, coreTokenQueryPluginToolNames };
