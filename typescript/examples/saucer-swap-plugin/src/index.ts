import type { Context, Plugin } from "hedera-agent-kit";

// Import all tool files
import getSwapQuoteV2Tool, { GET_SWAP_QUOTE_V2_TOOL } from "./tools/get-swap-quote-v2";
import swapV2Tool, { SWAP_V2_TOOL } from "./tools/swap-v2";

export const saucerSwapPlugin: Plugin = {
  name: 'saucer-swap-plugin',
  version: '1.0.0',
  description: 'A plugin for SaucerSwap V2 DeFi operations on Hedera',
  tools: (context: Context) => {
    return [
        getSwapQuoteV2Tool(context),
        swapV2Tool(context),
    ];
  }
};

export const saucerSwapPluginToolNames = {
  GET_SWAP_QUOTE_V2_TOOL,
  SWAP_V2_TOOL
} as const;

export default { saucerSwapPlugin, saucerSwapPluginToolNames };
