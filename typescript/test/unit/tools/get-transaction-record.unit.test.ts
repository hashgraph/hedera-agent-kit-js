import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, LedgerId } from '@hashgraph/sdk';
import toolFactory, {
  GET_TRANSACTION_RECORD_QUERY_TOOL,
} from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';
import { getTransactionRecordQuery } from '@/plugins/core-transactions-query-plugin/tools/queries/get-transaction-record-query';
import * as mirrornodeUtils from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import type { TransactionDetailsResponse } from '@/shared/hedera-utils/mirrornode/types';

const makeClient = () => {
  const client = Client.forNetwork({});
  client.setLedgerId(LedgerId.TESTNET);
  return client;
};

describe('Tool Logic - getTransactionRecordQuery', () => {
  const context: any = { accountId: '0.0.1001' };
  const client = makeClient();

  const mockService = {
    getTransactionRecord: vi.fn<[], any>(),
  } as unknown as {
    getTransactionRecord: (txId: string, nonce?: number) => Promise<TransactionDetailsResponse>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mirrornodeUtils, 'getMirrornodeService').mockReturnValue(mockService as any);
  });

  it('exposes correct tool metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_TRANSACTION_RECORD_QUERY_TOOL);
    expect(tool.name).toBe('Get Transaction Record Query');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('This tool will return the transaction record');
    expect(tool.parameters).toBeTruthy();
  });

  it('calls mirror node service with provided transactionId and nonce, and formats response', async () => {
    const tool = toolFactory(context);
    const txId = '0.0.1001-1755169980-651721264';
    const nonce = 3;
    const response: TransactionDetailsResponse = {
      transactions: [
        {
          consensus_timestamp: '1755169980.651721264',
          transaction_hash: '0xdeadbeef',
          charged_tx_fee: 12345,
          name: 'CRYPTOTRANSFER',
          result: 'SUCCESS',
          entity_id: '0.0.1001',
          transfers: [
            {
              account: '0.0.111',
              amount: -100000000,
              is_approval: true,
            },
            {
              account: '0.0.222',
              amount: 100000000,
              is_approval: true,
            },
          ],
          batch_key: null,
          bytes: null,
          max_fee: '',
          max_custom_fees: [],
          memo_base64: '',
          nft_transfers: [],
          node: '',
          nonce: 0,
          parent_consensus_timestamp: null,
          scheduled: false,
          staking_reward_transfers: [],
          token_transfers: [],
          transaction_id: '',
          valid_duration_seconds: '',
          valid_start_timestamp: '',
        },
      ],
    };

    (mockService.getTransactionRecord as any).mockResolvedValue(response);

    const res = await tool.execute(client, context, { transactionId: txId, nonce });

    expect(mirrornodeUtils.getMirrornodeService).toHaveBeenCalledWith(undefined, LedgerId.TESTNET);
    expect(mockService.getTransactionRecord).toHaveBeenCalledWith(txId, nonce);

    expect(res).toHaveProperty('raw.transactionId', txId);
    expect((res as any).raw.transactionRecord).toEqual(response);
    expect((res as any).humanMessage).toContain('Transaction Details for');
    expect((res as any).humanMessage).toContain('SUCCESS');
    expect((res as any).humanMessage).toContain('Transfers:');
    expect((res as any).humanMessage).toContain('ℏ');
  });

  it('formats multiple transactions with separators', async () => {
    const txId = '0.0.2002-123-456';
    const response: TransactionDetailsResponse = {
      transactions: [
        {
          consensus_timestamp: '123.456',
          transaction_hash: '0xaaa',
          charged_tx_fee: 111,
          name: 'CONSENSUSSUBMITMESSAGE',
          result: 'SUCCESS',
          entity_id: '0.0.2002',
          transfers: [],
        },
        {
          consensus_timestamp: '123.789',
          transaction_hash: '0xbbb',
          charged_tx_fee: 222,
          name: 'CRYPTOCREATEACCOUNT',
          result: 'FAIL',
          entity_id: '0.0.3003',
          transfers: [],
        },
      ],
    } as any;

    (mockService.getTransactionRecord as any).mockResolvedValue(response);

    const res = await getTransactionRecordQuery(client, context, { transactionId: txId });
    expect((res as any).humanMessage).toContain('Transaction 1 Details');
    expect((res as any).humanMessage).toContain('Transaction 2 Details');
    expect((res as any).humanMessage).toContain('='.repeat(50));
  });

  it('returns message when no transactions found', async () => {
    const txId = '0.0.9-10-11';
    const response: TransactionDetailsResponse = { transactions: [] } as any;

    (mockService.getTransactionRecord as any).mockResolvedValue(response);

    const res = await getTransactionRecordQuery(client, context, { transactionId: txId });
    expect((res as any).humanMessage).toBe(
      `No transaction details found for transaction ID: ${txId}`,
    );
  });

  it('returns aligned error response when mirror node throws an Error', async () => {
    (mockService.getTransactionRecord as any).mockRejectedValue(new Error('boom'));
    const result = await getTransactionRecordQuery(client, context, { transactionId: '0.0.1-1-1' });
    expect(result.humanMessage).toContain('Failed to get transaction record');
    expect(result.humanMessage).toContain('boom');
  });

  it('returns aligned generic failure message when mirror node throws non-Error', async () => {
    (mockService.getTransactionRecord as any).mockImplementation(() => {
      throw 'string error';
    });
    const result = await getTransactionRecordQuery(client, context, { transactionId: '0.0.1-1-1' });
    expect(result.humanMessage).toBe('Failed to get transaction record');
  });
});
