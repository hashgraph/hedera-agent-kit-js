import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { AccountId, Client, PrivateKey, TransactionId } from '@hashgraph/sdk';
import { getTransactionRecordQuery } from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { Context } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Integration - Hedera getTransactionRecord', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    // Use a separate executor account to avoid conflicts in parallel runs
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);
    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);
  });

  it('fetches record for a recent transfer using real Client', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create a self-transfer to produce a transaction id
    const rawResponse = await executorWrapper.transferHbar({
      hbarTransfers: [
        { accountId: executorAccountId, amount: 0.00000001 },
        { accountId: executorAccountId, amount: -0.00000001 },
      ],
    });
    const txIdSdkStyle = TransactionId.fromString(rawResponse.transactionId!);

    const txIdMirrorNodeStyle = `${txIdSdkStyle.accountId!.toString()}-${txIdSdkStyle.validStart!.seconds!.toString()}-${txIdSdkStyle.validStart!.nanos!.toString()}`;

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transaction to be indexed by mirrornode

    const result = await getTransactionRecordQuery(executorClient, context, {
      transactionId: txIdMirrorNodeStyle,
    });

    expect((result as any).raw.transactionId).toBe(txIdMirrorNodeStyle);
    expect((result as any).humanMessage).toContain('Transaction');
  });

  it('fails when transactionId format is invalid', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService,
    };

    const response = await getTransactionRecordQuery(executorClient, context, {
      transactionId: 'not-a-valid-id',
    });

    expect(response.humanMessage).toContain('Failed to get transaction record');
    expect(response.humanMessage).toContain('Invalid transactionId format');
  });

  it('throws an error for non-existent transaction', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService,
    };

    const nonExistentTxId = `${executorClient.operatorAccountId!.toString()}-123456789-000000000`;
    const response = await getTransactionRecordQuery(executorClient, context, {
      transactionId: nonExistentTxId,
    });
    expect(response.humanMessage).toContain('Not Found');
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      executorClient.close();
      operatorClient.close();
    }
  });
});
