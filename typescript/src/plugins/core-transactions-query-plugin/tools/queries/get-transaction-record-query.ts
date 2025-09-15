import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TransactionDetailsResponse } from '@/shared/hedera-utils/mirrornode/types';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { transactionRecordQueryParameters } from '@/shared/parameter-schemas/transaction.zod';

export const getTransactionRecordQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the transaction record for a given Hedera transaction ID.

Parameters:
- transactionId (str, required): The transaction ID to fetch record for. Should be in format \\"shard.realm.num-sss-nnn\\" format where sss are seconds and nnn are nanoseconds
- nonce (number, optional): Optional nonce value for the transaction
${usageInstructions}

Additional information:
If user provides transaction ID in format 0.0.4177806@1755169980.051721264, parse it to 0.0.4177806-1755169980-051721264 and use it as transaction ID. Do not remove the staring zeros.
`;
};

const postProcess = (transactionRecord: TransactionDetailsResponse, transactionId: string) => {
  if (!transactionRecord.transactions || transactionRecord.transactions.length === 0) {
    return `No transaction details found for transaction ID: ${transactionId}`;
  }

  const results = transactionRecord.transactions.map((tx, index) => {
    let transfersInfo = '';
    if (tx.transfers && tx.transfers.length > 0) {
      transfersInfo =
        '\nTransfers:\n' +
        tx.transfers
          .map(
            transfer =>
              `  Account: ${transfer.account}, Amount: ${toDisplayUnit(transfer.amount, 8)}ℏ`,
          )
          .join('\n');
    }

    const transactionHeader =
      transactionRecord.transactions.length > 1
        ? `Transaction ${index + 1} Details for ${transactionId}`
        : `Transaction Details for ${transactionId}`;

    return `${transactionHeader}
Status: ${tx.result}
Consensus Timestamp: ${tx.consensus_timestamp}
Transaction Hash: ${tx.transaction_hash}
Transaction Fee: ${tx.charged_tx_fee}
Type: ${tx.name}
Entity ID: ${tx.entity_id}${transfersInfo}`;
  });

  return results.join('\n\n' + '='.repeat(50) + '\n\n');
};

export const getTransactionRecordQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof transactionRecordQueryParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const normalisedParams = HederaParameterNormaliser.normaliseGetTransactionRecordParams(
      params,
      context,
    );

    const transactionRecord = await mirrornodeService.getTransactionRecord(
      normalisedParams.transactionId,
      normalisedParams.nonce,
    );

    return {
      raw: { transactionId: params.transactionId, transactionRecord: transactionRecord },
      humanMessage: postProcess(transactionRecord, params.transactionId),
    };
  } catch (error) {
    const desc = 'Failed to get transaction record';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_transaction_record_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_TRANSACTION_RECORD_QUERY_TOOL = 'get_transaction_record_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_TRANSACTION_RECORD_QUERY_TOOL,
  name: 'Get Transaction Record Query',
  description: getTransactionRecordQueryPrompt(context),
  parameters: transactionRecordQueryParameters(context),
  execute: getTransactionRecordQuery,
});

export default tool;
