import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import swapTokensTool, { SWAP_TOKENS_TOOL } from './tools/swap-tokens';

export const coreDexPlugin: Plugin = {
  name: 'core-dex-plugin',
  version: '1.0.0',
  description: 'A plugin for swapping tokens on Hedera DEXs',
  tools: (context: Context) => {
    return [swapTokensTool(context)];
  },
};

export { swapTokensTool, SWAP_TOKENS_TOOL };

// Export tool names as an object for destructuring
export const coreDexPluginToolNames = {
  SWAP_TOKENS_TOOL,
} as const;
