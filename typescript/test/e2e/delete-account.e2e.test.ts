import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key, PrivateKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { itWithRetry } from '../utils/retry-util';

describe('Delete Account E2E Tests with Pre-Created Accounts', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

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
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 8 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);
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

  async function createTestAccount(initialBalance = 0) {
    return executorWrapper.createAccount({
      key: executorClient.operatorPublicKey as Key,
      ...(initialBalance > 0 && { initialBalance }),
    });
  }

  it('deletes a pre-created account via agent (default transfer to operator)', itWithRetry(async () => {
    const resp = await createTestAccount();
    const targetAccountId = resp.accountId!.toString();

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
  }));

  it('should delete second pre-created account via agent (explicit transfer account)', itWithRetry(async () => {
    const resp = await createTestAccount();
    const targetAccountId = resp.accountId!.toString();

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccountId} and transfer remaining balance to ${executorClient.operatorAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
  }));

  it('should fail to delete a non-existent account', itWithRetry(async () => {
    const fakeAccountId = '0.0.999999999';

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${fakeAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    expect(observation.humanMessage || JSON.stringify(observation)).toMatch(
      /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
    );
  }));

  it('should handle natural language variations', itWithRetry(async () => {
    const resp = await createTestAccount(5);
    const targetAccountId = resp.accountId!.toString();

    const operatorBalanceBefore = await executorWrapper.getAccountHbarBalance(
      executorClient.operatorAccountId?.toString()!,
    );

    const deleteResult = await agentExecutor.invoke({
      input: `Remove account id ${targetAccountId} and send balance to ${executorClient.operatorAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    const operatorBalanceAfter = await executorWrapper.getAccountHbarBalance(
      executorClient.operatorAccountId?.toString()!,
    );

    expect(observation.humanMessage).toContain('deleted');
    await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
    expect(operatorBalanceAfter.gt(operatorBalanceBefore)).toBeTruthy();
  }));
});
