import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, PublicKey, Status } from '@hashgraph/sdk';
import { TokenInfo } from '@/shared/hedera-utils/mirrornode/types';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import {
  updateTokenParameters,
  updateTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { AccountResolver } from '@/shared';

const checkValidityOfUpdates = async (
  params: z.infer<ReturnType<typeof updateTokenParametersNormalised>>,
  mirrornode: IHederaMirrornodeService,
  userPublicKey: PublicKey,
) => {
  const tokenDetails: TokenInfo = await mirrornode.getTokenInfo(params.tokenId.toString());
  if (!tokenDetails) {
    throw new Error('Token not found');
  }

  if (tokenDetails.admin_key?.key !== userPublicKey.toStringRaw()) {
    console.error(
      `tokenDetails.admin_key.key: ${tokenDetails.admin_key?.key} vs userPublicKey: ${userPublicKey.toStringRaw()}`,
    );
    throw new Error(
      'You do not have permission to update this token. The adminKey does not match your public key.',
    );
  }

  const keyChecks: Partial<Record<keyof typeof params, keyof TokenInfo>> = {
    adminKey: 'admin_key',
    kycKey: 'kyc_key',
    freezeKey: 'freeze_key',
    wipeKey: 'wipe_key',
    supplyKey: 'supply_key',
    feeScheduleKey: 'fee_schedule_key',
    pauseKey: 'pause_key',
    metadataKey: 'metadata_key',
  };

  for (const [paramKey, tokenField] of Object.entries(keyChecks) as [
    keyof typeof params,
    keyof TokenInfo,
  ][]) {
    const userValue = params[paramKey];
    const tokenKey = tokenDetails[tokenField];

    if (userValue instanceof PublicKey && !tokenKey) {
      throw new Error(`Cannot update ${paramKey}: token was created without a ${paramKey}`);
    }
  }
};

const updateTokenPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const tokenDesc = PromptGenerator.getAnyAddressParameterDescription('tokenId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will update an existing Hedera HTS token. Only the fields provided will be updated.

Key fields (adminKey, kycKey, freezeKey, wipeKey, supplyKey, feeScheduleKey, pauseKey, metadataKey) must contain **Hedera-compatible public keys (as strings) or boolean (true/false)**. You can provide these in one of three ways:

1. **Boolean true** – Set this field to use user/operator key. Injecting of the key will be handled automatically.
2. **Not provided** – The field will not be updated.
3. **String** – Provide a Hedera-compatible public key string to set a field explicitly.

Parameters:
- ${tokenDesc}
- tokenName (string, optional): New name for the token. Up to 100 characters.
- tokenSymbol (string, optional): New symbol for the token. Up to 100 characters.
- treasuryAccountId (string, optional): New treasury account for the token (Hedera account ID).
- adminKey (boolean|string, optional): New admin key. Pass true to use your operator key, or provide a public key string.
- kycKey (boolean|string, optional): New KYC key. Pass true to use your operator key, or provide a public key string.
- freezeKey (boolean|string, optional): New freeze key. Pass true to use your operator key, or provide a public key string.
- wipeKey (boolean|string, optional): New wipe key. Pass true to use your operator key, or provide a public key string.
- supplyKey (boolean|string, optional): New supply key. Pass true to use your operator key, or provide a public key string.
- feeScheduleKey (boolean|string, optional): New fee schedule key. Pass true to use your operator key, or provide a public key string.
- pauseKey (boolean|string, optional): New pause key. Pass true to use your operator key, or provide a public key string.
- metadataKey (boolean|string, optional): New metadata key. Pass true to use your operator key, or provide a public key string.
- metadata (string, optional): New metadata for the token, in bytes (hex or base64).
- tokenMemo (string, optional): Short public memo for the token, up to 100 characters.
- autoRenewAccountId (string, optional): Account to automatically pay for renewal.

Examples:
- If the user asks for "my key" → set the field to \`true\`.
- If the user does not mention the key → do not set the field.
- If the user provides a key → set the field to the provided public key string.

If the user provides multiple fields in a single request, 
combine them into **one tool call** with all parameters together.

${usageInstructions}
`;
};

const postProcess = (response: RawTransactionResponse) => {
  return `Token successfully updated. Transaction ID: ${response.transactionId}`;
};

const updateToken = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof updateTokenParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseUpdateToken(
      params,
      context,
      client,
    );
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const userPublicKey = await AccountResolver.getDefaultPublicKey(context, client);

    await checkValidityOfUpdates(normalisedParams, mirrornodeService, userPublicKey);

    const tx = HederaBuilder.updateToken(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to update token';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[update_token_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
};

export const UPDATE_TOKEN_TOOL = 'update_token_tool';

const tool = (context: Context): Tool => ({
  method: UPDATE_TOKEN_TOOL,
  name: 'Update Token',
  description: updateTokenPrompt(context),
  parameters: updateTokenParameters(context),
  execute: updateToken,
});

export default tool;
