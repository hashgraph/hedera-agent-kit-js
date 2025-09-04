import { coreTokenPlugin, coreTokenPluginToolNames } from './core-token-plugin';
import { coreAccountPlugin, coreAccountPluginToolNames } from './core-account-plugin';
import { coreConsensusPlugin, coreConsensusPluginToolNames } from './core-consensus-plugin';
import { coreQueriesPlugin, coreQueriesPluginToolNames } from './core-queries-plugin';
import { coreEVMPlugin, coreEVMPluginToolNames } from './core-evm-plugin';
import {
  coreAccountQueryPlugin,
  coreAccountQueryPluginToolNames,
} from './core-account-query-plugin';
import { coreTokenQueryPlugin, coreTokenQueryPluginToolNames } from './core-token-query-plugin';
import {
  coreConsensusQueryPlugin,
  coreConsensusQueryPluginToolNames,
} from './core-consensus-query-plugin';
import { coreEVMQueryPlugin, coreEVMQueryPluginToolNames } from './core-evm-query-plugin';


export {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
  coreQueriesPlugin,
  coreTokenPluginToolNames,
  coreAccountPluginToolNames,
  coreConsensusPluginToolNames,
  coreQueriesPluginToolNames,
  coreEVMPlugin,
  coreEVMPluginToolNames,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreAccountQueryPluginToolNames,
  coreTokenQueryPluginToolNames,
  coreConsensusQueryPluginToolNames,
  coreEVMQueryPlugin,
  coreEVMQueryPluginToolNames,
};

// Deprecated exports for backward compatibility
/**
 * @deprecated Use coreTokenPlugin instead. This export will be removed in a future version.
 */
export const coreHTSPlugin = coreTokenPlugin;

/**
 * @deprecated Use coreTokenPluginToolNames instead. This export will be removed in a future version.
 */
export const coreHTSPluginToolNames = coreTokenPluginToolNames;

/**
 * @deprecated Use coreEVMPlugin instead. This export will be removed in a future version.
 */
export const coreSCSPlugin = coreEVMPlugin;

/**
 * @deprecated Use coreEVMPluginToolNames instead. This export will be removed in a future version.
 */
export const coreSCSPluginToolNames = coreEVMPluginToolNames;
