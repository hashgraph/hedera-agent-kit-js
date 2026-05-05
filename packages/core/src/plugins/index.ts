// Barrel re-export of all core plugins.
// Tree-shakeable when paired with "sideEffects": false in package.json.
// Unused plugins are dropped by bundlers (webpack, Vite, Rollup, esbuild).

import type { Plugin } from '../shared/plugin';

// Mutation plugins
import { coreAccountPlugin } from './core-account-plugin';
import { coreTokenPlugin } from './core-token-plugin';
import { coreConsensusPlugin } from './core-consensus-plugin';
import { coreEVMPlugin } from './core-evm-plugin';

// Query plugins
import { coreAccountQueryPlugin } from './core-account-query-plugin';
import { coreTokenQueryPlugin } from './core-token-query-plugin';
import { coreConsensusQueryPlugin } from './core-consensus-query-plugin';
import { coreEVMQueryPlugin } from './core-evm-query-plugin';
import { coreMiscQueriesPlugin } from './core-misc-query-plugin';
import { coreTransactionQueryPlugin } from './core-transactions-query-plugin';

/**
 * All core plugins in a single array for quick setup.
 *
 * @example
 * ```ts
 * import { allCorePlugins } from '@hashgraph/hedera-agent-kit/plugins';
 *
 * const toolkit = new HederaLangchainToolkit({
 *   client,
 *   configuration: {
 *     plugins: allCorePlugins,
 *     context: { mode: AgentMode.AUTONOMOUS },
 *   },
 * });
 * ```
 */
export const allCorePlugins: Plugin[] = [
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
];

// Re-export everything from each plugin (tool names, individual tools, etc.)
export * from './core-account-plugin';
export * from './core-token-plugin';
export * from './core-consensus-plugin';
export * from './core-evm-plugin';
export * from './core-account-query-plugin';
export * from './core-token-query-plugin';
export * from './core-consensus-query-plugin';
export * from './core-evm-query-plugin';
export * from './core-misc-query-plugin';
export * from './core-transactions-query-plugin';
