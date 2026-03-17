import { z } from 'zod';
import { Client, Status } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { BaseTool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { TransactionDetailsResponse } from '@/shared/hedera-utils/mirrornode/types';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { transactionRecordQueryParameters } from '@/shared/parameter-schemas/transaction.zod';
import { untypedQueryOutputParser } from '@/shared/utils/default-tool-output-parsing';

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

export const GET_TRANSACTION_RECORD_QUERY_TOOL = 'get_transaction_record_query_tool';

export class GetTransactionRecordQueryTool extends BaseTool {
  method = GET_TRANSACTION_RECORD_QUERY_TOOL;
  name = 'Get Transaction Record Query';
  description: string;
  parameters: ReturnType<typeof transactionRecordQueryParameters>;
  outputParser = untypedQueryOutputParser;

  constructor(context: Context) {
    super();
    this.description = getTransactionRecordQueryPrompt(context);
    this.parameters = transactionRecordQueryParameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof transactionRecordQueryParameters>>,
    context: Context,
    _client: Client,
  ) {
    return HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context);
  }

  async coreAction(normalisedParams: any, context: Context, client: Client) {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const transactionRecord = await mirrornodeService.getTransactionRecord(
      normalisedParams.transactionId,
      normalisedParams.nonce,
    );

    return {
      raw: { transactionId: normalisedParams.transactionId, transactionRecord: transactionRecord },
      humanMessage: postProcess(transactionRecord, normalisedParams.transactionId),
    };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context): Promise<boolean> {
    return false;
  }

  async secondaryAction(_transaction: any, _client: Client, _context: Context) {
    return null;
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const desc = 'Failed to get transaction record';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_transaction_record_query_tool]', message);
    return { raw: { status: Status.InvalidTransaction, error: message }, humanMessage: message };
  }
}

const tool = (context: Context): BaseTool => new GetTransactionRecordQueryTool(context);

export default tool;
