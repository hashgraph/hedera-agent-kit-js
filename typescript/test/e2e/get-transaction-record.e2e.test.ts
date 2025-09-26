import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { Client, TransactionId, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import Long from 'long';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Transaction Record E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let txIdSdkStyle: TransactionId;
  let txIdMirrorNodeStyle: string;

  // The operator account (from env variables) funds the setup process.
  // 1. An executor account is created using the operator account as the source of HBARs.
  // 2. The executor account is used to perform all Hedera operations required for the tests.
  // 3. LangChain is configured to run with the executor account as its client.
  // 4. After all tests are complete, the executor account is deleted and its remaining balance
  //    is transferred back to the operator account.
  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Create a self-transfer to produce a transaction id
    const operatorAccountId = executorClient.operatorAccountId!.toString();
    const rawResponse = await executorWrapper.transferHbar({
      hbarTransfers: [
        { accountId: operatorAccountId, amount: 0.00000001 },
        { accountId: operatorAccountId, amount: -0.00000001 },
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
    if (testSetup && operatorClient) {
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  it('fetches transaction record - SDK transactionId notation', itWithRetry(async () => {
    const input = `Get the transaction record for transaction ID ${txIdSdkStyle}`;
    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain(`Transaction Details for ${txIdMirrorNodeStyle}`);
  }));

  it('fetches transaction record - Mirror Node transactionId notation', itWithRetry(async () => {
    const input = `Get the transaction record for transaction ${txIdMirrorNodeStyle}`;
    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain(`Transaction Details for ${txIdMirrorNodeStyle}`);
  }));

  it('handles non-existent transaction ID', itWithRetry(async () => {
    const invalidTxId = '0.0.1-1756968265-043000618';
    const input = `Get the transaction record for transaction ${invalidTxId}`;

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeDefined();
    expect(observation.raw.error).toContain('Failed to get transaction record');
    expect(observation.raw.error).toContain('Not Found');
    expect(observation.humanMessage).toContain('Failed to get transaction record');
    expect(observation.humanMessage).toContain('Not Found');
  }));

  it('handles invalid transaction ID format', itWithRetry(async () => {
    const invalidTxId = 'invalid-tx-id';
    const input = `Get the transaction record for transaction ${invalidTxId}`;

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeDefined();
    expect(observation.raw.error).toContain('Invalid transactionId format: invalid-tx-id');
    expect(observation.raw.error).toContain('Failed to get transaction record');
    expect(observation.humanMessage).toContain('Failed to get transaction record');
  }));
});
