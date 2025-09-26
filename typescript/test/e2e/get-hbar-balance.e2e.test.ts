import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { wait } from '../utils/general-util';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get HBAR Balance E2E Tests with Intermediate Execution Account', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let targetAccount1: AccountId;
  let targetAccount2: AccountId;
  let account1Balance: number;
  let account2Balance: number;

  beforeAll(async () => {
    // operator client and wrapper
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // executor account creation
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // LangChain setup using executor client
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

    account1Balance = 2;
    account2Balance = 0;

    // create test accounts using executorWrapper
    targetAccount1 = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: account1Balance,
      })
      .then(resp => resp.accountId!);

    targetAccount2 = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: account2Balance,
      })
      .then(resp => resp.accountId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (testSetup && executorWrapper && operatorClient) {
      // delete accounts using executor wrapper
      await executorWrapper.deleteAccount({
        accountId: targetAccount1,
        transferAccountId: executorClient.operatorAccountId!,
      });
      await executorWrapper.deleteAccount({
        accountId: targetAccount2,
        transferAccountId: executorClient.operatorAccountId!,
      });

      // delete executor account and transfer remaining balance to operator
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });

      testSetup.cleanup();
      operatorClient.close();
      executorClient.close();
    }
  });

  it('should return balance when asking for default executor account', itWithRetry(async () => {
    const executorId = executorClient.operatorAccountId!.toString();
    const executorBalance = await operatorWrapper.getAccountHbarBalance(executorId); // operator will pay for the query and we wont need to wait for mirror node to update

    const input = `What is the HBAR balance of ${executorId}?`;
    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.raw.accountId).toBe(executorId);
    expect(observation.humanMessage).toContain(
      `Account ${executorId} has a balance of ${toDisplayUnit(executorBalance, 8).toNumber()}`,
    );
    expect(observation.raw.hbarBalance).toBe(toDisplayUnit(executorBalance, 8).toString());
  }));

  it('should return balance for specific account with non-zero balance', itWithRetry(async () => {
    const input = `What is the HBAR balance of ${targetAccount1.toString()}?`;
    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.raw.accountId).toBe(targetAccount1.toString());
    expect(observation.humanMessage).toContain(
      `Account ${targetAccount1.toString()} has a balance of ${account1Balance}`,
    );
    expect(observation.raw.hbarBalance).toBe(account1Balance.toString());
  }));

  it('should return balance for specific account with zero balance', itWithRetry(async () => {
    const input = `What is the HBAR balance of ${targetAccount2.toString()}?`;
    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.raw.accountId).toBe(targetAccount2.toString());
    expect(observation.humanMessage).toContain(
      `Account ${targetAccount2.toString()} has a balance of ${account2Balance}`,
    );
    expect(observation.raw.hbarBalance).toBe(account2Balance.toString());
  }));
});
