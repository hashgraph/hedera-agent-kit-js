import { z } from 'zod';
import type { Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, PublicKey, Status } from '@hashgraph/sdk';
import { handleTransaction, RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { AccountResolver } from '@/shared';
import {
  updateTopicParameters,
  updateTopicParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { TopicInfo } from '@/shared/hedera-utils/mirrornode/types';

const checkValidityOfUpdates = async (
  params: z.infer<ReturnType<typeof updateTopicParametersNormalised>>,
  mirrornode: IHederaMirrornodeService,
  userPublicKey: PublicKey,
) => {
  const topicDetails: TopicInfo = await mirrornode.getTopicInfo(params.topicId.toString());
  if (!topicDetails) {
    throw new Error('Topic not found');
  }

  if (topicDetails.admin_key === undefined) {
    throw new Error('Topic does not have an admin key. It cannot be updated.');
  }

  if (topicDetails.admin_key!.key !== userPublicKey.toStringRaw()) {
    console.error(
      `topicDetails.admin_key.key: ${topicDetails.admin_key?.key} vs userPublicKey: ${userPublicKey.toStringRaw()}`,
    );
    throw new Error(
      'You do not have permission to update this topic. The adminKey does not match your public key.',
    );
  }

  // If a user attempts to set a key but the topic was created without that key, disallow
  const keyChecks: Partial<Record<keyof typeof params, keyof TopicInfo>> = {
    adminKey: 'admin_key',
    submitKey: 'submit_key',
  };

  for (const [paramKey, topicField] of Object.entries(keyChecks) as [
    keyof typeof params,
    keyof TopicInfo,
  ][]) {
    const userValue = params[paramKey];
    const topicKey = topicDetails[topicField as keyof TopicInfo];

    if (userValue instanceof PublicKey && !topicKey) {
      throw new Error(`Cannot update ${paramKey}: topic was created without a ${paramKey}`);
    }
  }
};

const updateTopicPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const topicDesc = PromptGenerator.getAnyAddressParameterDescription('topicId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}
This tool will update an existing Hedera Consensus Topic. Only the fields provided will be updated.
Key fields (adminKey, submitKey) must contain **Hedera-compatible public keys (as strings) or boolean (true/false)**. You can provide these in one of three ways:
1. **Boolean true** – Set this field to use user/operator key. Injecting of the key will be handled automatically.
2. **Not provided** – The field will not be updated.
3. **String** – Provide a Hedera-compatible public key string to set a field explicitly.

Parameters:
- ${topicDesc}
- topicMemo (string, optional): New memo for the topic.
- adminKey (boolean|string, optional): New admin key. Pass true to use your operator key, or provide a public key string.
- submitKey (boolean|string, optional): New submit key. Pass true to use your operator key, or provide a public key string.
- autoRenewAccountId (string, optional): Account to automatically pay for renewal.
- autoRenewPeriod (number, optional): Auto renew period in seconds.
- expirationTime (string|Date, optional): New expiration time for the topic (ISO string or Date).
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
  return `Topic successfully updated. Transaction ID: ${response.transactionId}`;
};

const updateTopic = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof updateTopicParameters>>,
) => {
  try {
    const normalisedParams = await HederaParameterNormaliser.normaliseUpdateTopic(
      params,
      context,
      client,
    );
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const userPublicKey = await AccountResolver.getDefaultPublicKey(context, client);

    await checkValidityOfUpdates(normalisedParams, mirrornodeService, userPublicKey);

    const tx = HederaBuilder.updateTopic(normalisedParams);

    return await handleTransaction(tx, client, context, postProcess);
  } catch (error) {
    const desc = 'Failed to update topic';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[update_topic_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
};

export const UPDATE_TOPIC_TOOL = 'update_topic_tool';

const tool = (context: Context): Tool => ({
  method: UPDATE_TOPIC_TOOL,
  name: 'Update Topic',
  description: updateTopicPrompt(context),
  parameters: updateTopicParameters(context),
  execute: updateTopic,
});

export default tool;
