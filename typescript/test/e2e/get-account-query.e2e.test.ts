import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key, PrivateKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Account Query E2E Tests', () => {
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

  it('should return account info for a newly created account', itWithRetry(async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = await hederaOps
      .createAccount({
        key: privateKey.publicKey as Key,
        initialBalance: 10,
      })
      .then(resp => resp.accountId!);

    // Give the mirror node a chance to sync
    await wait(MIRROR_NODE_WAITING_TIME);

    const queryResult = await agentExecutor.invoke({
      input: `Get account info for ${accountId.toString()}`,
    });

    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.humanMessage).toContain(`Details for ${accountId.toString()}`);
    expect(observation.humanMessage).toContain('Balance:');
    expect(observation.humanMessage).toContain('Public Key:');
    expect(observation.humanMessage).toContain('EVM address:');

    // Verify state directly
    const info = await hederaOps.getAccountInfo(accountId.toString());
    expect(info.accountId.toString()).toBe(accountId.toString());
    expect(info.balance).toBeDefined();
    expect(info.key?.toString()).toBe(privateKey.publicKey.toStringDer());
  }));

  it('should return account info for the operator account', itWithRetry(async () => {
    const operatorId = client.operatorAccountId!.toString();

    const queryResult = await agentExecutor.invoke({
      input: `Query details for account ${operatorId}`,
    });

    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.humanMessage).toContain(`Details for ${operatorId}`);
    expect(observation.humanMessage).toContain('Balance:');
    expect(observation.humanMessage).toContain('Public Key:');
    expect(observation.humanMessage).toContain('EVM address:');

    const info = await hederaOps.getAccountInfo(operatorId);
    expect(info.accountId.toString()).toBe(operatorId);
  }));

  it('should fail gracefully for non-existent account', itWithRetry(async () => {
    const fakeAccountId = '0.0.999999999';

    const queryResult = await agentExecutor.invoke({
      input: `Get account info for ${fakeAccountId}`,
    });

    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation.humanMessage).toContain(`Failed to fetch account ${fakeAccountId}`);
  }));
});
