import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import airdropFungibleToken, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/airdrop-fungible-token';
import createFungibleTokenTool, {
  CREATE_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/create-fungible-token';
import mintFungibleTokenTool, {
  MINT_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/mint-fungible-token';
import createNonFungibleTokenTool, {
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/create-non-fungible-token';
import mintNonFungibleTokenTool, {
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/mint-non-fungible-token';
import dissociateTokenTool, {
  DISSOCIATE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/dissociate-token';
import associateTokenTool, {
  ASSOCIATE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/associate-token';

export const coreTokenPlugin: Plugin = {
  name: 'core-token-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Token Service',
  tools: (context: Context) => {
    return [
      createFungibleTokenTool(context),
      mintFungibleTokenTool(context),
      createNonFungibleTokenTool(context),
      airdropFungibleToken(context),
      mintNonFungibleTokenTool(context),
      dissociateTokenTool(context),
      associateTokenTool(context),
    ];
  },
};

// Export tool names as an object for destructuring
export const coreTokenPluginToolNames = {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  CREATE_FUNGIBLE_TOKEN_TOOL,
  MINT_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
  DISSOCIATE_TOKEN_TOOL,
  ASSOCIATE_TOKEN_TOOL,
} as const;

export default { coreTokenPlugin, coreTokenPluginToolNames };
