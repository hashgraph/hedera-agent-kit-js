import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Key } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Delete Account E2E Tests with Pre-Created Accounts', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({
      tier: 'STANDARD',
      accountMemo: 'executor account for Delete Account E2E Tests',
    });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  async function createTestAccount(initialBalance = 0) {
    return executorWrapper.createAccount({
      key: executor.privateKey.publicKey as Key,
      ...(initialBalance > 0 && { initialBalance }),
      accountMemo: 'test account for Delete Account E2E Tests',
    });
  }

  it(
    'deletes a pre-created account via agent (default transfer to operator)',
    itWithRetry(async () => {
      const resp = await createTestAccount();
      const targetAccountId = resp.accountId!.toString();

      const deleteResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Delete the account ${targetAccountId}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(deleteResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('deleted');

      await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
    }),
  );

  it(
    'should delete second pre-created account via agent (explicit transfer account)',
    itWithRetry(async () => {
      const resp = await createTestAccount();
      const targetAccountId = resp.accountId!.toString();

      const deleteResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Delete the account ${targetAccountId} and transfer remaining balance to ${executor.accountId.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(deleteResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('deleted');

      await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
    }),
  );

  it(
    'should fail to delete a non-existent account',
    itWithRetry(async () => {
      const fakeAccountId = '0.0.999999999';

      const deleteResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Delete the account ${fakeAccountId}. This account does not exist but try to call the tool anyway.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(deleteResult);
      expect(parsedResponse[0].parsedData.humanMessage).toMatch(
        /INVALID_ACCOUNT_ID|ACCOUNT_DELETED|NOT_FOUND|INVALID_SIGNATURE/i,
      );
    }),
  );

  it(
    'should handle natural language variations',
    itWithRetry(async () => {
      const resp = await createTestAccount(5);
      const targetAccountId = resp.accountId!.toString();

      const operatorBalanceBefore = await executorWrapper.getAccountHbarBalance(
        executor.accountId.toString(),
      );

      const deleteResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Remove account id ${targetAccountId} and send balance to ${executor.accountId.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(deleteResult);
      const operatorBalanceAfter = await executorWrapper.getAccountHbarBalance(
        executor.accountId.toString(),
      );

      expect(parsedResponse[0].parsedData.humanMessage).toContain('deleted');
      await expect(executorWrapper.getAccountInfo(targetAccountId)).rejects.toBeDefined();
      expect(operatorBalanceAfter.gt(operatorBalanceBefore)).toBeTruthy();
    }),
  );
});
