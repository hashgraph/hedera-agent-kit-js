import { Plugin } from '@/shared/plugin';
import { Context } from '@/shared/configuration';
import createERC20Tool, { CREATE_ERC20_TOOL } from './tools/erc20/create-erc20';
import transferERC20Tool, { TRANSFER_ERC20_TOOL } from './tools/erc20/transfer-erc20';
import transferERC721Tool, {
  TRANSFER_ERC721_TOOL,
} from '@/plugins/core-evm-plugin/tools/erc721/transfer-erc721';
import mintERC721Tool, {
  MINT_ERC721_TOOL,
} from '@/plugins/core-evm-plugin/tools/erc721/mint-erc721';
import createERC721Tool, {
  CREATE_ERC721_TOOL,
} from '@/plugins/core-evm-plugin/tools/erc721/create-erc721';

export const coreEVMPlugin: Plugin = {
  name: 'core-evm-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera EVM',
  tools: (context: Context) => {
    return [
      createERC20Tool(context),
      transferERC20Tool(context),
      transferERC721Tool(context),
      mintERC721Tool(context),
      createERC721Tool(context),
    ];
  },
};

// Export tool names as an object for destructuring
export const coreEVMPluginToolNames = {
  TRANSFER_ERC721_TOOL,
  MINT_ERC721_TOOL,
  CREATE_ERC20_TOOL,
  TRANSFER_ERC20_TOOL,
  CREATE_ERC721_TOOL,
} as const;

export default { coreEVMPlugin, coreEVMPluginToolNames };
