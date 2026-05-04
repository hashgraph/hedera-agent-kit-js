import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AccountId, Client, Key } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Update Account E2E Tests with Pre-Created Accounts', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executionWrapper: HederaOperationsWrapper;
  let targetAccount: AccountId; // account created per test, tests run one by one

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executionWrapper } = profile.client.connectAs(executor));

    // setting up langchain to run with the execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    targetAccount = await executionWrapper
      .createAccount({
        key: executor.privateKey.publicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);
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
