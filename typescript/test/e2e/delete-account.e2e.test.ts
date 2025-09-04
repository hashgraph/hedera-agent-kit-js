import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import { createLangchainTestSetup, HederaOperationsWrapper, LangchainTestSetup } from '../utils';
import { extractObservationFromLangchainResponse } from '../utils/general-util';

describe('Delete Account E2E Tests with Pre-Created Accounts', () => {
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

  it('should delete first pre-created account via agent (default transfer to operator)', async () => {
    const resp = await hederaOperationsWrapper.createAccount({
      key: client.operatorPublicKey as Key,
    });
    const targetAccountId = resp.accountId!.toString();

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(hederaOperationsWrapper.getAccountInfo(resp.toString())).rejects.toBeDefined();
  });

  it('should delete second pre-created account via agent (explicit transfer account)', async () => {
    const resp = await hederaOperationsWrapper.createAccount({
      key: client.operatorPublicKey as Key,
    });
    const targetAccountId = resp.accountId!.toString();

    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${targetAccountId} and transfer remaining balance to ${client.operatorAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    expect(observation.humanMessage).toContain('deleted');

    await expect(hederaOperationsWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
  });

  it('should fail to delete a non-existent account', async () => {
    const fakeAccountId = '0.0.999999999';
    const deleteResult = await agentExecutor.invoke({
      input: `Delete the account ${fakeAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(deleteResult);
    // Expect the agent to indicate failure
    expect(observation.humanMessage || JSON.stringify(observation)).toMatch(
      /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
    );
  });

  it('should handle natural language variations', async () => {
    const resp = await hederaOperationsWrapper.createAccount({
      key: client.operatorPublicKey as Key,
      initialBalance: 5,
    });
    const targetAccountId = resp.accountId!.toString();

    const operatorBalanceBefore = await hederaOperationsWrapper.getAccountHbarBalance(
      client.operatorAccountId?.toString()!,
    );

    const deleteResult = await agentExecutor.invoke({
      input: `Remove account id ${targetAccountId} and send balance to ${client.operatorAccountId}`,
    });
    const observation = extractObservationFromLangchainResponse(deleteResult);
    const operatorBalanceAfter = await hederaOperationsWrapper.getAccountHbarBalance(
      client.operatorAccountId?.toString()!,
    );

    expect(observation.humanMessage).toContain('deleted');
    await expect(hederaOperationsWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
    expect(operatorBalanceAfter.gt(operatorBalanceBefore)).toBeTruthy(); // not checking the exact amount, just that it's greater because the delete action and balance check with use of consensus node cost some HBARs
  });
});
