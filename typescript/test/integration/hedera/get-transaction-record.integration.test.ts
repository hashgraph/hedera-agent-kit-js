import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { AccountId, Client, TransactionId } from '@hashgraph/sdk';
import { getTransactionRecordQuery } from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';
import { getClientForTests, HederaOperationsWrapper } from '../../utils';
import { Context } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { wait } from '../../utils/general-util';

describe('Integration - Hedera getTransactionRecord', () => {
  let client: Client;
  let context: Context;
  let operatorAccountId: AccountId;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getClientForTests();
  });

  it('fetches record for a recent transfer using real Client', async () => {
    const mirrornodeService = getMirrornodeService(undefined, client.ledgerId!);
    context = {
      accountId: client.operatorAccountId!.toString(),
      mirrornodeService: mirrornodeService,
    };
    operatorAccountId = client.operatorAccountId!;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    // Create a self-transfer to produce a transaction id
    const rawResponse = await hederaOperationsWrapper.transferHbar({
      hbarTransfers: [
        { accountId: operatorAccountId, amount: 0.00000001 },
        { accountId: operatorAccountId, amount: -0.00000001 },
      ],
    });
    const txIdSdkStyle = TransactionId.fromString(rawResponse.transactionId!);

    const txIdMirrorNodeStyle = `${txIdSdkStyle.accountId!.toString()}-${txIdSdkStyle.validStart!.seconds!.toString()}-${txIdSdkStyle.validStart!.nanos!.toString()}`;

    await wait(4000); // waiting for the transaction to be indexed by mirrornode

    const result = await getTransactionRecordQuery(client, context, {
      transactionId: txIdMirrorNodeStyle,
    });

    expect((result as any).raw.transactionId).toBe(txIdMirrorNodeStyle);
    expect((result as any).humanMessage).toContain('Transaction');
  });

  it('fails when transactionId format is invalid', async () => {
    const mirrornodeService = getMirrornodeService(undefined, client.ledgerId!);
    context = {
      accountId: client.operatorAccountId!.toString(),
      mirrornodeService,
    };

    const response = await getTransactionRecordQuery(client, context, {
      transactionId: 'not-a-valid-id',
    });

    expect(response).toContain('Invalid transactionId format');
  });

  it('throws an error for non-existent transaction', async () => {
    const mirrornodeService = getMirrornodeService(undefined, client.ledgerId!);
    context = {
      accountId: client.operatorAccountId!.toString(),
      mirrornodeService,
    };

    const nonExistentTxId = `${client.operatorAccountId!.toString()}-123456789-000000000`;
    const response = await getTransactionRecordQuery(client, context, {
      transactionId: nonExistentTxId,
    });
    expect(response).toContain('Not Found');
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
  });
});
