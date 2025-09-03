import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import { createLangchainTestSetup, HederaOperationsWrapper, LangchainTestSetup } from '../utils';

function extractObservation(agentResult: any): any {
  if (!agentResult.intermediateSteps || agentResult.intermediateSteps.length === 0) {
    throw new Error('No intermediate steps found in agent result');
  }
  const lastStep = agentResult.intermediateSteps[agentResult.intermediateSteps.length - 1];
  const observationRaw = lastStep.observation;
  if (!observationRaw) throw new Error('No observation found in intermediate step');
  return JSON.parse(observationRaw);
}

describe('Delete Account E2E Tests with Pre-Created Accounts', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let client: Client;
  let hederaOps: HederaOperationsWrapper;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOps = new HederaOperationsWrapper(client);
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  it('should delete first pre-created account via agent (default transfer to operator)', async () => {
    const targetAccount = await hederaOps.createAccount({ key: client.operatorPublicKey as Key });

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccount.toString()}`,
    });

    const observation = extractObservation(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(hederaOps.getAccountInfo(targetAccount.toString())).rejects.toBeDefined();
  });

  it('should delete second pre-created account via agent (explicit transfer account)', async () => {
    const targetAccount = await hederaOps.createAccount({ key: client.operatorPublicKey as Key });

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccount.toString()} and transfer remaining balance to ${client.operatorAccountId}`,
    });

    const observation = extractObservation(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(hederaOps.getAccountInfo(targetAccount.toString())).rejects.toBeDefined();
  });

  it('should fail to delete a non-existent account', async () => {
    const fakeAccountId = '0.0.999999999';
    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${fakeAccountId}`,
    });

    const observation = extractObservation(deleteResult);
    // Expect the agent to indicate failure
    expect(observation.humanMessage || JSON.stringify(observation)).toMatch(
      /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
    );
  });

  it('should handle natural language variations', async () => {
    const targetAccount = await hederaOps.createAccount({
      key: client.operatorPublicKey as Key,
      initialBalance: 5,
    });
    const operatorBalanceBefore = await hederaOps.getAccountHbarBalance(
      client.operatorAccountId?.toString()!,
    );

    const deleteResult = await agentExecutor.invoke({
      input: `Remove account id ${targetAccount.toString()} and send balance to ${client.operatorAccountId}`,
    });
    const observation = extractObservation(deleteResult);
    const operatorBalanceAfter = await hederaOps.getAccountHbarBalance(
      client.operatorAccountId?.toString()!,
    );

    expect(observation.humanMessage).toContain('deleted');
    await expect(hederaOps.getAccountInfo(targetAccount.toString())).rejects.toBeDefined();
    expect(operatorBalanceAfter.gt(operatorBalanceBefore)).toBeTruthy(); // not checking the exact amount, just that it's greater because the delete action and balance check with use of consensus node cost some HBARs
  });
});
