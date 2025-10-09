import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import airdropFungibleToken, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/airdrop-fungible-token';
import transferFungibleTokenWithAllowanceTool, {
  TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token-with-allowance';
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
import approveNftAllowanceTool, {
  APPROVE_NFT_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import updateTokenTool, { UPDATE_TOKEN_TOOL } from '@/plugins/core-token-plugin/tools/update-token';
import dissociateTokenTool, {
  DISSOCIATE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/dissociate-token';
import associateTokenTool, {
  ASSOCIATE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/associate-token';
import transferNonFungibleTokenWithAllowanceTool, {
  TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token-with-allowance';

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
      approveNftAllowanceTool(context),
      updateTokenTool(context),
      dissociateTokenTool(context),
      associateTokenTool(context),
      transferNonFungibleTokenWithAllowanceTool(context),
      transferFungibleTokenWithAllowanceTool(context),
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
  APPROVE_NFT_ALLOWANCE_TOOL,
  DISSOCIATE_TOKEN_TOOL,
  ASSOCIATE_TOKEN_TOOL,
  UPDATE_TOKEN_TOOL,
  TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
  TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
} as const;

export default { coreTokenPlugin, coreTokenPluginToolNames };
