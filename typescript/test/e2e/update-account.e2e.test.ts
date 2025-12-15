import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';

describe('Update Account E2E Tests with Pre-Created Accounts', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executionWrapper: HederaOperationsWrapper;
  let targetAccount: AccountId; // account created per test, tests run one by one

  // The operator account (from env variables) funds the setup process.
  // 1. An executor account is created using the operator account as the source of HBARs.
  // 2. The executor account is used to perform all Hedera operations required for the tests.
  // 3. LangChain is configured to run with the executor account as its client.
  // 4. After all tests are complete, the executor account is deleted and its remaining balance
  //    is transferred back to the operator account.
  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(0.75) })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executionWrapper = new HederaOperationsWrapper(executorClient);

    // setting up langchain to run with the execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await executionWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    targetAccount = await executionWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);
  });

  afterEach(async () => {
    await executionWrapper.deleteAccount({
      accountId: targetAccount,
      transferAccountId: executorClient.operatorAccountId!,
    });
  });

  it(
    'should update memo of a pre-created account via agent',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Update account ${targetAccount.toString()} memo to "updated via agent"`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('updated');

      const info = await executionWrapper.getAccountInfo(targetAccount.toString());
      expect(info.accountMemo).toBe('updated via agent');
    }),
  );

  it(
    'should update maxAutomaticTokenAssociations via agent',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Set max automatic token associations for account ${targetAccount.toString()} to 10`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('updated');

      const info = await executionWrapper.getAccountInfo(targetAccount.toString());
      expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(10);
    }),
  );

  it(
    'should update declineStakingReward flag via agent',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Update account ${targetAccount.toString()} to decline staking rewards`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('updated');

      const info = await executionWrapper.getAccountInfo(targetAccount.toString());
      expect(info.stakingInfo?.declineStakingReward).toBeTruthy();
    }),
  );

  it(
    'should schedule account update',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Update account ${targetAccount.toString()} memo to "updated via agent". Schedule the transaction instead of executing it immediately.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled account update created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'should fail to update a non-existent account',
    itWithRetry(async () => {
      const fakeAccountId = '0.0.999999999';
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Update account ${fakeAccountId} memo to "x"`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toMatch(
        /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
      );
    }),
  );
});
