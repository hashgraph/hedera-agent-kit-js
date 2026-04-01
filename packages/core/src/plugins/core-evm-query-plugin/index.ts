import { Plugin } from '../../shared/plugin';
import { Context } from '../../shared/configuration';
import getContractInfoQuery, {
  GET_CONTRACT_INFO_QUERY_TOOL,
} from './tools/queries/get-contract-info-query';

export const coreEVMQueryPlugin: Plugin = {
  name: 'core-evm-query-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera EVM Service queries',
  tools: (context: Context) => {
    return [getContractInfoQuery(context)];
  },
};

export {
  getContractInfoQuery,
  GET_CONTRACT_INFO_QUERY_TOOL,
};

export const coreEVMQueryPluginToolNames = {
  GET_CONTRACT_INFO_QUERY_TOOL,
} as const;
