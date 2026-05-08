import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Client, TransactionId } from '@hiero-ledger/sdk';
import { GetTransactionRecordQueryTool } from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import type { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Integration - Hedera getTransactionRecord', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));
  });

  it('fetches record for a recent transfer using real Client', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create a self-transfer to produce a transaction id
    const rawResponse = await executorWrapper.transferHbar({
      hbarTransfers: [
        { accountId: executor.accountId, amount: 0.00000001 },
        { accountId: executor.accountId, amount: -0.00000001 },
      ],
    });
    const txIdSdkStyle = TransactionId.fromString(rawResponse.transactionId!);

    const txIdMirrorNodeStyle = `${txIdSdkStyle.accountId!.toString()}-${txIdSdkStyle.validStart!.seconds!.toString()}-${txIdSdkStyle.validStart!.nanos!.toString()}`;

    await waitForMirrorTx(executorWrapper, rawResponse.transactionId!); // waiting for the transaction to be indexed by mirrornode

    const tool = new GetTransactionRecordQueryTool(context);
    const result = await tool.execute(executorClient, context, {
      transactionId: txIdMirrorNodeStyle,
    });

    expect((result as any).raw.transactionId).toBe(txIdMirrorNodeStyle);
    expect((result as any).humanMessage).toContain('Transaction');
  });

  it('fails when transactionId format is invalid', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService,
    };

    const tool = new GetTransactionRecordQueryTool(context);
    const response = await tool.execute(executorClient, context, {
      transactionId: 'not-a-valid-id',
    });

    expect(response.humanMessage).toContain('Failed to get transaction record');
    expect(response.humanMessage).toContain('Invalid transactionId format');
  });

  it('throws an error for non-existent transaction', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService,
    };

    const nonExistentTxId = `${executor.accountId.toString()}-123456789-000000000`;
    const tool = new GetTransactionRecordQueryTool(context);
    const response = await tool.execute(executorClient, context, {
      transactionId: nonExistentTxId,
    });
    expect(response.humanMessage).toContain('Not Found');
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });
});
