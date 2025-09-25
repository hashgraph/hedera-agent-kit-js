import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { Client } from '@hashgraph/sdk';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TokenAirdropsResponse, TokenAirdrop } from '@/shared/hedera-utils/mirrornode/types';
import { pendingAirdropQueryParameters } from '@/shared/parameter-schemas/token.zod';
import { AccountResolver } from '@/shared/utils/account-resolver';

export const getPendingAirdropQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const accountDesc = PromptGenerator.getAccountParameterDescription('accountId', context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return pending airdrops for a given Hedera account.

Parameters:
- ${accountDesc}
${usageInstructions}
`;
};

const formatAirdrop = (airdrop: TokenAirdrop, index: number) => {
  const token = airdrop.token_id ?? 'N/A';
  const amount = airdrop.amount ?? 0;
  const serial = airdrop.serial_number ?? 'N/A';
  const sender = airdrop.sender_id ?? 'N/A';
  const receiver = airdrop.receiver_id ?? 'N/A';
  const fromTs = airdrop.timestamp?.from ?? 'N/A';
  const toTs = airdrop.timestamp?.to ?? 'N/A';
  return `#${index + 1} Token: ${token}, Amount: ${amount}, Serial: ${serial}, Sender: ${sender}, Receiver: ${receiver}, Timestamp: ${fromTs}${toTs ? ` → ${toTs}` : ''}`;
};

const postProcess = (accountId: string, response: TokenAirdropsResponse) => {
  const count = response.airdrops?.length ?? 0;
  if (count === 0) {
    return `No pending airdrops found for account ${accountId}`;
  }

  const details = response.airdrops.map(formatAirdrop).join('\n');
  return `Here are the pending airdrops for account **${accountId}** (total: ${count}):\n\n${details}`;
};

export const getPendingAirdropQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof pendingAirdropQueryParameters>>,
) => {
  try {
    const accountId = params.accountId ?? AccountResolver.getDefaultAccount(context, client);
    if (!accountId) throw new Error('Account ID is required and was not provided');

    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const response = await mirrornodeService.getPendingAirdrops(accountId);

    return {
      raw: { accountId, pendingAirdrops: response },
      humanMessage: postProcess(accountId, response),
    };
  } catch (error) {
    const desc = 'Failed to get pending airdrops';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_pending_airdrop_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_PENDING_AIRDROP_TOOL = 'get_pending_airdrop_tool';

const tool = (context: Context): Tool => ({
  method: GET_PENDING_AIRDROP_TOOL,
  name: 'Get Pending Airdrops',
  description: getPendingAirdropQueryPrompt(context),
  parameters: pendingAirdropQueryParameters(context),
  execute: getPendingAirdropQuery,
});

export default tool;


