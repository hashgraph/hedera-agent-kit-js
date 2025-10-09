import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { tokenInfoQueryParameters } from '@/shared/parameter-schemas/token.zod';
import { Client } from '@hashgraph/sdk';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TokenInfo } from '@/shared/hedera-utils/mirrornode/types';

export const getTokenInfoQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the information for a given Hedera token. Make sure to return token symbol.

Parameters:
- tokenId (str): The token ID to query for.
${usageInstructions}
`;
};

const postProcess = (tokenInfo: TokenInfo) => {
  const formatSupply = (supply?: string) => {
    if (!supply) return 'N/A';

    const decimals = Number(tokenInfo.decimals || '0');
    const amount = Number(supply);
    if (isNaN(amount)) return supply;

    return (amount / 10 ** decimals).toLocaleString();
  };

  const formatKey = (key?: { _type: string; key: string } | null) => {
    if (!key) return 'Not Set';
    return key._type ? `${key.key}` : 'Present';
  };

  const supplyType = tokenInfo.supply_type === 'INFINITE' ? 'Infinite' : 'Finite';
  const freezeStatus = tokenInfo.freeze_default ? 'Frozen' : 'Active';

  return `Here are the details for token **${tokenInfo.token_id}**:

- **Token Name**: ${tokenInfo.name}
- **Token Symbol**: ${tokenInfo.symbol}
- **Token Type**: ${tokenInfo.type || 'N/A'}
- **Decimals**: ${tokenInfo.decimals}
- **Max Supply**: ${formatSupply(tokenInfo.max_supply)}
- **Current Supply**: ${formatSupply(tokenInfo.total_supply)}
- **Supply Type**: ${supplyType}
- **Treasury Account ID**: ${tokenInfo.treasury_account_id || 'N/A'}
- **Status (Deleted/Active)**: ${tokenInfo.deleted ? 'Deleted' : 'Active'}
- **Status (Frozen/Active)**: ${freezeStatus}

**Keys**:
- Admin Key: ${formatKey(tokenInfo.admin_key)}
- Supply Key: ${formatKey(tokenInfo.supply_key)}
- Wipe Key: ${formatKey(tokenInfo.wipe_key)}
- KYC Key: ${formatKey(tokenInfo.kyc_key)}
- Freeze Key: ${formatKey(tokenInfo.freeze_key)}
- Fee Schedule Key: ${formatKey(tokenInfo.fee_schedule_key)}
- Pause Key: ${formatKey(tokenInfo.pause_key)}
- Metadata Key: ${formatKey(tokenInfo.metadata_key)}

${tokenInfo.memo ? `**Memo**: ${tokenInfo.memo}` : ''}
`;
};

export const getTokenInfoQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof tokenInfoQueryParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const tokenInfo: TokenInfo = {
      ...(await mirrornodeService.getTokenInfo(params.tokenId!)),
      token_id: params.tokenId!,
    };

    return {
      raw: { tokenId: params.tokenId, tokenInfo },
      humanMessage: postProcess(tokenInfo),
    };
  } catch (error) {
    const desc = 'Failed to get token info';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_token_info_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_TOKEN_INFO_QUERY_TOOL = 'get_token_info_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_TOKEN_INFO_QUERY_TOOL,
  name: 'Get Token Info',
  description: getTokenInfoQueryPrompt(context),
  parameters: tokenInfoQueryParameters(context),
  execute: getTokenInfoQuery,
});

export default tool;
