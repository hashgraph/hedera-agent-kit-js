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

describe('Update Account E2E Tests with Pre-Created Accounts', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let client: Client;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  it('should update memo of a pre-created account via agent', async () => {
    const targetAccount = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    const updateResult = await agentExecutor.invoke({
      input: `Update account ${targetAccount.toString()} memo to "updated via agent"`,
    });

    const observation = extractObservation(updateResult);
    expect(observation.humanMessage).toContain('updated');

    const info = await hederaOperationsWrapper.getAccountInfo(targetAccount.toString());
    expect(info.accountMemo).toBe('updated via agent');
  });

  it('should update maxAutomaticTokenAssociations via agent', async () => {
    const targetAccount = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    const updateResult = await agentExecutor.invoke({
      input: `Set max automatic token associations for account ${targetAccount.toString()} to 10`,
    });

    const observation = extractObservation(updateResult);
    expect(observation.humanMessage).toContain('updated');

    const info = await hederaOperationsWrapper.getAccountInfo(targetAccount.toString());
    expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(10);
  });

  it('should update declineStakingReward flag via agent', async () => {
    const targetAccount = await hederaOperationsWrapper
      .createAccount({
        key: client.operatorPublicKey as Key,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    const updateResult = await agentExecutor.invoke({
      input: `Update account ${targetAccount.toString()} to decline staking rewards`,
    });

    const observation = extractObservation(updateResult);
    expect(observation.humanMessage).toContain('updated');

    const info = await hederaOperationsWrapper.getAccountInfo(targetAccount.toString());
    expect(info.stakingInfo?.declineStakingReward).toBeTruthy();
  });

  it('should fail to update a non-existent account', async () => {
    const fakeAccountId = '0.0.999999999';
    const updateResult = await agentExecutor.invoke({
      input: `Update account ${fakeAccountId} memo to "x"`,
    });

    const observation = extractObservation(updateResult);
    expect(observation.humanMessage || JSON.stringify(observation)).toMatch(
      /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
    );
  });
});
