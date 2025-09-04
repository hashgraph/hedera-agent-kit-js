import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { Client, TransactionId } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';

describe('Get Transaction Record E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let client: Client;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let txIdSdkStyle: TransactionId;
  let txIdMirrorNodeStyle: string;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    // Create a self-transfer to produce a transaction id
    const operatorAccountId = client.operatorAccountId!.toString();
    const rawResponse = await hederaOperationsWrapper.transferHbar({
      hbarTransfers: [
        { accountId: operatorAccountId, amount: 0.00000001 },
        { accountId: operatorAccountId, amount: -0.00000001 },
      ],
    });

    txIdSdkStyle = TransactionId.fromString(rawResponse.transactionId!);
    txIdMirrorNodeStyle = `${txIdSdkStyle.accountId!.toString()}-${txIdSdkStyle.validStart!.seconds!.toString()}-${txIdSdkStyle.validStart!.nanos!.toString()}`;

    await wait(4000);
  });

  it('should fetch transaction record via agent flow for a real transaction - sdk notation of transaction id', async () => {
    const input = `Get the transaction record for transaction ID ${txIdSdkStyle}`;

    const result = await agentExecutor.invoke({ input });

    const observation = extractObservationFromLangchainResponse(result);

    // The agent should execute the tool and return an output that contains transaction details
    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain(`Transaction Details for ${txIdMirrorNodeStyle}`);
  });

  it('should fetch transaction record via agent flow for a real transaction - mirror node notation of transaction id', async () => {
    const input = `Get the transaction record for transaction ${txIdMirrorNodeStyle}`;

    const result = await agentExecutor.invoke({ input });

    const observation = extractObservationFromLangchainResponse(result);

    // The agent should execute the tool and return an output that contains transaction details
    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain(`Transaction Details for ${txIdMirrorNodeStyle}`);
  });

  it('should handle fetching invalid transaction', async () => {
    const invalidTxId = '0.0.1-1756968265-043000618';
    const input = `Get the transaction record for transaction ${invalidTxId}`;

    const result = await agentExecutor.invoke({ input });

    const observation = extractObservationFromLangchainResponse(result);

    // The agent should execute the tool and return an output that contains transaction details
    expect(observation).toBeDefined();
    expect(observation.raw.error).toContain('HTTP error! status: 404. Message: Not Found');
    expect(observation.raw.transactionId).toContain(invalidTxId);
  });

  it('should handle fetching invalid transaction', async () => {
    const invalidTxId = 'invalid-tx-id';
    const input = `Get the transaction record for transaction ${invalidTxId}`;

    const result = await agentExecutor.invoke({ input });

    const observation = extractObservationFromLangchainResponse(result);

    // The agent should execute the tool and return an output that contains transaction details
    expect(observation).toBeDefined();
    console.log(JSON.stringify(observation, null, 2));
    expect(observation.raw.error).toContain('Invalid transactionId format: invalid-tx-id');
    expect(observation.raw.transactionId).toContain(invalidTxId);
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });
});
