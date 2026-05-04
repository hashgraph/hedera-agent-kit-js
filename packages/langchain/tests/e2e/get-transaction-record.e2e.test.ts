import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client, TransactionId } from '@hiero-ledger/sdk';
import Long from 'long';

describe('Get Transaction Record E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let txIdSdkStyle: TransactionId;
  let txIdMirrorNodeStyle: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Create a self-transfer to produce a transaction id
    const accountId = executor.accountId.toString();
    const rawResponse = await executorWrapper.transferHbar({
      hbarTransfers: [
        { accountId, amount: 0.00000001 },
        { accountId, amount: -0.00000001 },
      ],
    });

    txIdSdkStyle = TransactionId.fromString(rawResponse.transactionId!);

    const padNanos = (n: Long | number) => n.toString().padStart(9, '0');
    txIdMirrorNodeStyle = `${txIdSdkStyle.accountId!.toString()}-${txIdSdkStyle.validStart!.seconds!.toString()}-${padNanos(
      txIdSdkStyle.validStart!.nanos!,
    )}`;

    // Wait for the mirror node to index the transaction
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'fetches transaction record - SDK transactionId notation',
    itWithRetry(async () => {
      const input = `Get the transaction record for transaction ID ${txIdSdkStyle}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Transaction Details for ${txIdMirrorNodeStyle}`,
      );
    }),
  );

  it(
    'fetches transaction record - Mirror Node transactionId notation',
    itWithRetry(async () => {
      const input = `Get the transaction record for transaction ${txIdMirrorNodeStyle}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Transaction Details for ${txIdMirrorNodeStyle}`,
      );
    }),
  );

  it(
    'handles non-existent transaction ID',
    itWithRetry(async () => {
      const invalidTxId = '0.0.1-1756968265-043000618';
      const input = `Get the transaction record for transaction ${invalidTxId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.error).toContain('Failed to get transaction record');
      expect(parsedResponse[0].parsedData.raw.error).toContain('Not Found');
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to get transaction record',
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Not Found');
    }),
  );

  it(
    'handles invalid transaction ID format',
    itWithRetry(async () => {
      const invalidTxId = 'invalid-tx-id';
      const input = `Get the transaction record for transaction ${invalidTxId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'Invalid transactionId format: invalid-tx-id',
      );
      expect(parsedResponse[0].parsedData.raw.error).toContain('Failed to get transaction record');
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to get transaction record',
      );
    }),
  );
});
