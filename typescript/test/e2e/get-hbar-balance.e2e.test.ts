import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createLangchainTestSetup, HederaOperationsWrapper, LangchainTestSetup } from '../utils';
import { AgentExecutor } from 'langchain/agents';
import { AccountId, Client, Key } from '@hashgraph/sdk';
import { wait } from '../utils/general-utils';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';

function extractObservation(agentResult: any): any {
  if (!agentResult.intermediateSteps || agentResult.intermediateSteps.length === 0) {
    throw new Error('No intermediate steps found in agent result');
  }
  const lastStep = agentResult.intermediateSteps[agentResult.intermediateSteps.length - 1];
  const observationRaw = lastStep.observation;
  if (!observationRaw) throw new Error('No observation found in intermediate step');
  return JSON.parse(observationRaw);
}

describe('Get HBAR Balance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let client: Client;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let targetAccount1: AccountId;
  let targetAccount2: AccountId;
  let account1Balance: number;
  let account2Balance: number;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);
    account1Balance = 2;
    account2Balance = 0;

    targetAccount1 = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: account1Balance,
      })
      .then(resp => resp.accountId!);
    targetAccount2 = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: account2Balance,
      })
      .then(resp => resp.accountId!);

    await wait(4000);
  }, 15000);

  afterAll(async () => {
    if (testSetup) {
      await hederaOperationsWrapper.deleteAccount({
        accountId: targetAccount1,
        transferAccountId: client.operatorAccountId!,
      });
      await hederaOperationsWrapper.deleteAccount({
        accountId: targetAccount2,
        transferAccountId: client.operatorAccountId!,
      });
      testSetup.cleanup();
    }
  });

  it('should return balance when asking for default operator account', async () => {
    const operator = testSetup.client.operatorAccountId!.toString();
    const operatorAccountBalance = await hederaOperationsWrapper.getAccountHbarBalance(
      client.operatorAccountId!.toString(),
    );

    const input = `What is the HBAR balance of ${operator}?`;

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservation(result);

    expect(observation.raw.accountId).toBe(operator);
    expect(observation.humanMessage).toContain(
      `Account ${operator} has a balance of ${toDisplayUnit(operatorAccountBalance, 8).toNumber()}`,
    );
    expect(observation.raw.hbarBalance).toBe(toDisplayUnit(operatorAccountBalance, 8).toString());
  });

  it('should return balance when asking for specific account with non-zero hbar balance', async () => {
    const input = `What is the HBAR balance of ${targetAccount1.toString()}?`;

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservation(result);

    expect(observation.raw.accountId).toBe(targetAccount1.toString());
    expect(observation.humanMessage).toContain(
      `Account ${targetAccount1.toString()} has a balance of ${account1Balance}`,
    );
    expect(observation.raw.hbarBalance).toBe(account1Balance.toString());
  });

  it('should return balance when asking for specific account with zero hbar balance', async () => {
    const input = `What is the HBAR balance of ${targetAccount2.toString()}?`;

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservation(result);

    expect(observation.raw.accountId).toBe(targetAccount2.toString());
    expect(observation.humanMessage).toContain(
      `Account ${targetAccount2.toString()} has a balance of ${account2Balance}`,
    );
    expect(observation.raw.hbarBalance).toBe(account2Balance.toString());
  });
});
