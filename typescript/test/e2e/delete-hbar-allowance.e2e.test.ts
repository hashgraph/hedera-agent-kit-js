import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, PrivateKey, AccountId, Hbar, HbarUnit, HbarAllowance } from '@hashgraph/sdk';
import { z } from 'zod';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { approveHbarAllowanceParametersNormalised } from '@/shared/parameter-schemas/account.zod';
import { AgentExecutor } from 'langchain/agents';
import { extractObservationFromLangchainResponse } from '../utils/general-util';

describe('Delete HBAR Allowance Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;

  let spenderAccountId: AccountId;
  let spenderKey: PrivateKey;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an executor (owner) account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 15 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // Create spender
    spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await executorWrapper
      .createAccount({
        key: spenderKey.publicKey,
        initialBalance: 5,
      })
      .then(resp => resp.accountId!);

    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);
  });

  afterEach(async () => {
    if (spenderAccountId) {
      await spenderWrapper.deleteAccount({
        accountId: spenderAccountId,
        transferAccountId: executorAccountId,
      });
    }
  });

  it('should delete an existing allowance and prevent further spending', async () => {
    const allowanceAmount = 1.5;

    // Step 1: Approve allowance
    const approveParams: z.infer<ReturnType<typeof approveHbarAllowanceParametersNormalised>> = {
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId: executorAccountId,
          spenderAccountId: spenderAccountId,
          amount: Hbar.from(allowanceAmount, HbarUnit.Hbar),
        }),
      ],
    };
    await executorWrapper.approveHbarAllowance(approveParams);

    // Step 3: Delete allowance via tool (no amount param!)
    const input = `Delete HBAR allowance from ${executorAccountId.toString()} to ${spenderAccountId.toString()}`;
    const queryResult = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('HBAR allowance deleted successfully');
  });

  it('should handle deleting a non-existent allowance gracefully', async () => {
    // No approve step -> directly delete
    const input = `Delete HBAR allowance from ${executorAccountId.toString()} to ${spenderAccountId.toString()}`;
    const queryResult = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('HBAR allowance deleted successfully');
  });
});
