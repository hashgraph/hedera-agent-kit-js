import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey, ScheduleCreateTransaction, TransferTransaction } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse } from 'test/utils/general-util';

describe('Sign Schedule Transaction E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let recipientAccount: AccountId;

  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation
    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorKeyPair.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

  beforeEach(async () => {
    // Create recipient account
    recipientAccount = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);
  });

  afterEach(async () => {
    await executorWrapper.deleteAccount({
      accountId: recipientAccount,
      transferAccountId: executorClient.operatorAccountId!,
    });
  });

  it('should sign a scheduled transaction', async () => {
    // First, create a scheduled transaction
    const transferAmount = 0.1;
    const transferTx = new TransferTransaction()
      .addHbarTransfer(executorClient.operatorAccountId!, -transferAmount)
      .addHbarTransfer(recipientAccount, transferAmount);

    // Create the scheduled transaction
    const scheduleTx = await operatorWrapper.createScheduleTransaction({
      scheduledTransaction: transferTx,
      params: {
        scheduleMemo: 'Test scheduled transfer',
      },
    });
    
    const scheduleId = scheduleTx.scheduleId!.toString();
    // Now sign the scheduled transaction using the agent
    const input = `Sign the scheduled transaction with ID ${scheduleId}`;

    const result = await agentExecutor.invoke({ input });


    const observation = extractObservationFromLangchainResponse(result);
    expect(observation.humanMessage || JSON.stringify(observation)).toContain('Transaction successfully signed');
    expect(observation.humanMessage || JSON.stringify(observation)).toContain('Transaction ID');
  });

  it('should handle invalid schedule ID', async () => {
    const invalidScheduleId = '0.0.999999';
    const input = `Sign the scheduled transaction with ID ${invalidScheduleId}`;

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);
    // Should handle the error gracefully
    expect(observation.humanMessage || JSON.stringify(observation)).toContain('Failed to sign scheduled transaction');
  });
});
