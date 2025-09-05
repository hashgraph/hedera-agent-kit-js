import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import getTransactionRecordQuery, {
  GET_TRANSACTION_RECORD_QUERY_TOOL,
} from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';

export const coreTransactionQueryPlugin: Plugin = {
  name: 'core-transaction-query-plugin',
  version: '1.0.0',
  description: 'A plugin for Hedera Transactions queries',
  tools: (context: Context) => {
    return [getTransactionRecordQuery(context)];
  },
};

export const coreTransactionQueryPluginToolNames = {
  GET_TRANSACTION_RECORD_QUERY_TOOL,
} as const;

export default { coreTransactionQueryPlugin, coreTransactionQueryPluginToolNames };
